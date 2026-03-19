import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { compareNatural } from '@fast-renamer/rename-engine';
import type { RenameRule } from '@fast-renamer/rename-engine';
import {
  pickSourcesRequestSchema,
  executeRenameBatchRequestSchema,
  previewRequestSchema,
  undoRenameBatchRequestSchema,
} from '../src/shared/contracts';
import { AppDatabase } from './db';
import {
  executeRenameBatch,
  generatePreviewForRequest,
  listHistoryWithUndoStatus,
  loadDirectoryListing,
  pickableSource,
  undoRenameBatch,
} from './rename-service';
import { AppUpdaterManager } from './updater';

let mainWindow: BrowserWindow | null = null;
let database: AppDatabase;
let updater: AppUpdaterManager;
const mainDir = path.dirname(fileURLToPath(import.meta.url));

const getPlatform = () => process.platform as 'darwin' | 'win32' | 'linux';
const DEFAULT_WINDOW_STATE = { isMaximized: false };

function serializeWindowState(window: BrowserWindow) {
  return { isMaximized: window.isMaximized() };
}

function emitWindowState(window: BrowserWindow) {
  window.webContents.send('window:stateChanged', serializeWindowState(window));
}

function resolvePreloadPath() {
  const candidates = [
    path.join(app.getAppPath(), 'electron', 'preload.cjs'),
    path.join(mainDir, 'preload.cjs'),
    path.join(mainDir, 'preload.mjs'),
    path.join(mainDir, 'preload.js'),
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    throw new Error(`Unable to locate preload script. Checked: ${candidates.join(', ')}`);
  }

  return resolved;
}

function createWindow() {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const preloadPath = resolvePreloadPath();
  const isMac = process.platform === 'darwin';

  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1200,
    minHeight: 780,
    roundedCorners: true,
    ...(isMac
      ? {
          titleBarStyle: 'hidden',
          trafficLightPosition: { x: 16, y: 18 },
        }
      : {
          frame: false,
        }),
    backgroundColor: '#0d1117',
    title: 'Fast Renamer',
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });
  mainWindow = window;

  window.on('maximize', () => emitWindowState(window));
  window.on('unmaximize', () => emitWindowState(window));
  window.on('enter-full-screen', () => emitWindowState(window));
  window.on('leave-full-screen', () => emitWindowState(window));
  window.once('ready-to-show', () => emitWindowState(window));
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(app.getAppPath(), 'dist-renderer/index.html'));
  }
}

function registerIpc() {
  ipcMain.handle('pickSources', async (_event, payload) => {
    const request = pickSourcesRequestSchema.parse(payload);
    const shouldPickDirectories =
      request.mode === 'picked_folders' ||
      request.mode === 'top_level_folders' ||
      request.mode === 'subfolders' ||
      request.mode === 'top_level_files' ||
      request.mode === 'files_recursive';

    mainWindow?.focus();

    const result = await dialog.showOpenDialog({
      properties: shouldPickDirectories
        ? ['openDirectory', 'multiSelections']
        : ['openFile', 'multiSelections'],
    });
    if (result.canceled) {
      return [];
    }

    const sources = await Promise.all(result.filePaths.map((pathname) => pickableSource(pathname)));
    return sources.sort((left, right) => compareNatural(left.path, right.path));
  });

  ipcMain.handle('resolveSources', async (_event, paths: string[]) => {
    const uniquePaths = [...new Set(paths)].sort(compareNatural);
    const sources = await Promise.all(uniquePaths.map((pathname) => pickableSource(pathname)));
    return sources.sort((left, right) => compareNatural(left.path, right.path));
  });

  ipcMain.handle('loadDirectoryItems', async (_event, paths: string[]) => {
    const directoryPaths = [...paths].sort(compareNatural);
    const listings = await Promise.all(directoryPaths.map((sourcePath) => loadDirectoryListing(sourcePath)));
    return listings;
  });

  ipcMain.handle('generatePreview', async (_event, payload) => {
    const request = previewRequestSchema.parse(payload);
    return generatePreviewForRequest(request);
  });

  ipcMain.handle('executeRenameBatch', async (_event, payload) => {
    const request = executeRenameBatchRequestSchema.parse(payload);
    return executeRenameBatch(request, database);
  });

  ipcMain.handle('undoRenameBatch', async (_event, payload) => {
    const request = undoRenameBatchRequestSchema.parse(payload);
    return undoRenameBatch(request.batchId, getPlatform(), database);
  });

  ipcMain.handle('listPresets', () => database.listPresets());

  ipcMain.handle('savePreset', (_event, payload: { id?: number; name: string; rules: RenameRule[] }) =>
    database.savePreset(payload),
  );

  ipcMain.handle('deletePreset', (_event, presetId: number) => {
    database.deletePreset(presetId);
  });

  ipcMain.handle('listHistory', () => listHistoryWithUndoStatus(getPlatform(), database));

  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle('window:toggleMaximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return DEFAULT_WINDOW_STATE;
    }

    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }

    return serializeWindowState(window);
  });

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle('window:getState', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window ? serializeWindowState(window) : DEFAULT_WINDOW_STATE;
  });

  ipcMain.handle('updates:getState', () => updater.getState());
  ipcMain.handle('updates:check', () => updater.checkForUpdates());
  ipcMain.handle('updates:quitAndInstall', () => updater.quitAndInstall());
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  database = new AppDatabase();
  updater = new AppUpdaterManager(() => mainWindow);
  registerIpc();
  createWindow();
  updater.initialize();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  updater?.dispose();
});
