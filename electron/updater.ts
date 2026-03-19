import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import type { UpdateState } from '../src/shared/contracts';

const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6;
const GITHUB_RELEASES_URL = 'https://github.com/crushdotsoy/fastrenamer/releases';

function toIsoDate(value?: string | Date) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getMacManualDownloadMessage() {
  if (process.platform !== 'darwin' || !app.isPackaged) {
    return undefined;
  }

  const appBundlePath = path.resolve(process.execPath, '..', '..', '..');
  const result = spawnSync('codesign', ['-dv', '--verbose=4', appBundlePath], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return 'Automatic updates are unavailable because this macOS app build could not be verified for signing.';
  }

  const output = `${result.stdout}\n${result.stderr}`;
  const hasDeveloperIdAuthority = output.includes('Authority=Developer ID Application:');
  const hasTeamIdentifier = !output.includes('TeamIdentifier=not set');
  const isAdHocSigned = output.includes('Signature=adhoc');

  if (!hasDeveloperIdAuthority || !hasTeamIdentifier || isAdHocSigned) {
    return 'This macOS build is not Developer ID-signed, so updates must be downloaded manually from GitHub Releases.';
  }

  return undefined;
}

function getReleaseDownloadUrl(version?: string) {
  if (!version) {
    return `${GITHUB_RELEASES_URL}/latest`;
  }

  return `${GITHUB_RELEASES_URL}/tag/v${version}`;
}

function toBaseState(info: UpdateInfo | UpdateDownloadedEvent | undefined, previousState?: UpdateState) {
  return {
    currentVersion: app.getVersion(),
    availableVersion: info?.version ?? previousState?.availableVersion,
    releaseDate: toIsoDate(info?.releaseDate) ?? previousState?.releaseDate,
    releaseName: info?.releaseName ?? previousState?.releaseName,
    manualDownloadOnly: previousState?.manualDownloadOnly ?? false,
    downloadUrl: previousState?.downloadUrl,
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
  private manualDownloadOnly = false;
  private manualDownloadMessage?: string;

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

    this.manualDownloadMessage = getMacManualDownloadMessage();
    this.manualDownloadOnly = Boolean(this.manualDownloadMessage);

    if (this.manualDownloadOnly) {
      this.setState({
        ...this.state,
        manualDownloadOnly: true,
        message: this.manualDownloadMessage,
        downloadUrl: `${GITHUB_RELEASES_URL}/latest`,
      });
    }

    autoUpdater.autoDownload = !this.manualDownloadOnly;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.setState({
        ...toBaseState(undefined, this.state),
        status: 'checking',
        checkedAt: new Date().toISOString(),
        message: this.manualDownloadMessage,
      });
    });

    autoUpdater.on('update-available', (info) => {
      const downloadUrl = getReleaseDownloadUrl(info.version);
      this.setState({
        ...toBaseState(info, this.state),
        status: 'available',
        checkedAt: new Date().toISOString(),
        message: this.manualDownloadOnly
          ? `Version ${info.version} is available. Open GitHub to download the signed build manually.`
          : undefined,
        manualDownloadOnly: this.manualDownloadOnly,
        downloadUrl,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.setState({
        ...toBaseState(info, this.state),
        status: 'up-to-date',
        checkedAt: new Date().toISOString(),
        message: this.manualDownloadMessage,
        manualDownloadOnly: this.manualDownloadOnly,
        downloadUrl: this.manualDownloadOnly ? `${GITHUB_RELEASES_URL}/latest` : undefined,
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.setState({
        ...toBaseState(undefined, this.state),
        status: 'downloading',
        checkedAt: this.state.checkedAt ?? new Date().toISOString(),
        progress: this.toProgress(progress),
        message: undefined,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.setState({
        ...toBaseState(info, this.state),
        status: 'downloaded',
        checkedAt: new Date().toISOString(),
        message: undefined,
      });
    });

    autoUpdater.on('error', (error) => {
      this.setState({
        ...toBaseState(undefined, this.state),
        status: 'error',
        checkedAt: new Date().toISOString(),
        manualDownloadOnly: this.manualDownloadOnly,
        downloadUrl: this.manualDownloadOnly ? `${GITHUB_RELEASES_URL}/latest` : this.state.downloadUrl,
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
        ...toBaseState(undefined, this.state),
        status: 'error',
        checkedAt: new Date().toISOString(),
        manualDownloadOnly: this.manualDownloadOnly,
        downloadUrl: this.manualDownloadOnly ? `${GITHUB_RELEASES_URL}/latest` : this.state.downloadUrl,
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
