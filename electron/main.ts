import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
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

let mainWindow: BrowserWindow | null = null;
let database: AppDatabase;
const mainDir = path.dirname(fileURLToPath(import.meta.url));

const getPlatform = () => process.platform as 'darwin' | 'win32' | 'linux';

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

  mainWindow = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1200,
    minHeight: 780,
    backgroundColor: '#0d1117',
    title: 'Fast Renamer',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), 'dist-renderer/index.html'));
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
}

app.whenReady().then(() => {
  database = new AppDatabase();
  registerIpc();
  createWindow();

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
