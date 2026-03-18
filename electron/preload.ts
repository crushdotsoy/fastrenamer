import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AdvancedRenamerApi } from '../src/shared/contracts';

const api: AdvancedRenamerApi = {
  getDroppedPaths: (files) =>
    files
      .map((file) => webUtils.getPathForFile(file))
      .filter((pathname) => pathname.length > 0),
  pickSources: (request) => ipcRenderer.invoke('pickSources', request),
  resolveSources: (paths) => ipcRenderer.invoke('resolveSources', paths),
  loadDirectoryItems: (paths) => ipcRenderer.invoke('loadDirectoryItems', paths),
  generatePreview: (request) => ipcRenderer.invoke('generatePreview', request),
  executeRenameBatch: (request) => ipcRenderer.invoke('executeRenameBatch', request),
  undoRenameBatch: (request) => ipcRenderer.invoke('undoRenameBatch', request),
  listPresets: () => ipcRenderer.invoke('listPresets'),
  savePreset: (input) => ipcRenderer.invoke('savePreset', input),
  deletePreset: (id) => ipcRenderer.invoke('deletePreset', id),
  listHistory: () => ipcRenderer.invoke('listHistory'),
};

contextBridge.exposeInMainWorld('advancedRenamer', api);
