import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import type { UpdateState } from '../src/shared/contracts';

const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6;

function toIsoDate(value?: string | Date) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toBaseState(
  info: UpdateInfo | UpdateDownloadedEvent | undefined,
  previousState?: UpdateState,
) {
  return {
    currentVersion: app.getVersion(),
    availableVersion: info?.version ?? previousState?.availableVersion,
    releaseDate: toIsoDate(info?.releaseDate) ?? previousState?.releaseDate,
    releaseName: info?.releaseName ?? previousState?.releaseName,
  };
}

export class AppUpdaterManager {
  private state: UpdateState = {
    status: 'idle',
    currentVersion: app.getVersion(),
  };

  private interval: NodeJS.Timeout | null = null;
  private initialized = false;
  private checking = false;

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  getState() {
    return this.state;
  }

  initialize() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (!app.isPackaged) {
      this.setState({
        status: 'disabled',
        currentVersion: app.getVersion(),
        message: 'Automatic updates are only available in installed release builds.',
      });
      return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.setState({
        status: 'checking',
        checkedAt: new Date().toISOString(),
        ...toBaseState(undefined, this.state),
      });
    });

    autoUpdater.on('update-available', (info) => {
      this.setState({
        status: 'available',
        checkedAt: new Date().toISOString(),
        ...toBaseState(info, this.state),
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.setState({
        status: 'up-to-date',
        checkedAt: new Date().toISOString(),
        ...toBaseState(info, this.state),
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.setState({
        status: 'downloading',
        checkedAt: this.state.checkedAt ?? new Date().toISOString(),
        progress: this.toProgress(progress),
        ...toBaseState(undefined, this.state),
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.setState({
        status: 'downloaded',
        checkedAt: new Date().toISOString(),
        ...toBaseState(info, this.state),
      });
    });

    autoUpdater.on('error', (error) => {
      this.setState({
        status: 'error',
        checkedAt: new Date().toISOString(),
        ...toBaseState(undefined, this.state),
        message: error.message || 'Failed to check for updates.',
      });
    });

    void this.checkForUpdates();
    this.interval = setInterval(() => {
      void this.checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);
  }

  dispose() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async checkForUpdates() {
    if (!app.isPackaged) {
      return this.state;
    }

    if (this.checking) {
      return this.state;
    }

    this.checking = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check for updates.';
      this.setState({
        status: 'error',
        checkedAt: new Date().toISOString(),
        ...toBaseState(undefined, this.state),
        message,
      });
    } finally {
      this.checking = false;
    }

    return this.state;
  }

  quitAndInstall() {
    if (this.state.status !== 'downloaded') {
      return false;
    }

    this.setState({
      ...this.state,
      status: 'installing',
    });
    autoUpdater.quitAndInstall(false, true);
    return true;
  }

  private toProgress(progress: ProgressInfo) {
    return {
      bytesPerSecond: progress.bytesPerSecond,
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    };
  }

  private setState(nextState: UpdateState) {
    this.state = nextState;
    const window = this.getWindow();
    window?.webContents.send('update:stateChanged', nextState);
  }
}
