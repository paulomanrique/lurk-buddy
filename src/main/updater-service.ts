import { app } from 'electron';
import {
  autoUpdater,
  type AppUpdater,
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo
} from 'electron-updater';
import type { LogService } from '../modules/logging/log-service.js';
import type { UpdaterState } from '../shared/types.js';

type UpdaterClient = Pick<
  AppUpdater,
  'autoDownload' | 'autoInstallOnAppQuit' | 'allowPrerelease' | 'checkForUpdates' | 'quitAndInstall' | 'on'
>;

interface UpdaterServiceOptions {
  autoUpdater?: UpdaterClient;
  isPackaged?: boolean;
  currentVersion?: string;
  platform?: NodeJS.Platform;
}

const RELEASE_URL = 'https://github.com/paulomanrique/lurk-buddy/releases/latest';

const DEFAULT_STATE: UpdaterState = {
  enabled: false,
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  downloadPercent: null,
  error: null,
  manualReason: null,
  releaseUrl: RELEASE_URL
};

export class UpdaterService {
  private readonly autoUpdater: UpdaterClient;
  private readonly isPackaged: boolean;
  private readonly platform: NodeJS.Platform;
  private readonly autoUpdatesSupported: boolean;
  private state: UpdaterState;
  private readonly listeners = new Set<() => void>();
  private initialized = false;

  constructor(
    private readonly logs: LogService,
    options: UpdaterServiceOptions = {}
  ) {
    this.autoUpdater = options.autoUpdater ?? autoUpdater;
    this.isPackaged = options.isPackaged ?? app.isPackaged;
    this.platform = options.platform ?? process.platform;
    this.autoUpdatesSupported = this.isPackaged && this.platform !== 'darwin';
    this.state = {
      ...DEFAULT_STATE,
      enabled: this.autoUpdatesSupported,
      currentVersion: options.currentVersion ?? DEFAULT_STATE.currentVersion,
      manualReason:
        this.isPackaged && this.platform === 'darwin'
          ? 'Manual download required on macOS until Apple code signing is available.'
          : null
    };
  }

  getState(): UpdaterState {
    return { ...this.state };
  }

  onStateChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  initialize(): void {
    if (!this.autoUpdatesSupported || this.initialized) {
      return;
    }

    this.initialized = true;
    this.autoUpdater.autoDownload = true;
    this.autoUpdater.autoInstallOnAppQuit = false;
    this.autoUpdater.allowPrerelease = false;

    this.autoUpdater.on('checking-for-update', () => {
      this.logs.write('info', 'updater', 'Checking for updates');
      this.setState({
        status: 'checking',
        availableVersion: null,
        downloadPercent: null,
        error: null
      });
    });

    this.autoUpdater.on('update-available', (info) => {
      this.logs.write('info', 'updater', 'Update available', {
        version: info.version
      });
      this.setState({
        status: 'available',
        availableVersion: info.version,
        downloadPercent: 0,
        error: null
      });
    });

    this.autoUpdater.on('download-progress', (progress) => {
      this.setStateFromProgress(progress);
    });

    this.autoUpdater.on('update-downloaded', (info) => {
      this.logs.write('info', 'updater', 'Update downloaded', {
        version: info.version
      });
      this.setState({
        status: 'downloaded',
        availableVersion: info.version,
        downloadPercent: 100,
        error: null
      });
    });

    this.autoUpdater.on('update-not-available', (info) => {
      this.logs.write('info', 'updater', 'No updates available', {
        version: info.version
      });
      this.setState({
        status: 'idle',
        availableVersion: null,
        downloadPercent: null,
        error: null
      });
    });

    this.autoUpdater.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logs.write('error', 'updater', 'Auto-update failed', { error: message });
      this.setState({
        status: 'error',
        downloadPercent: null,
        error: message
      });
    });
  }

  async checkForUpdates(): Promise<void> {
    if (!this.autoUpdatesSupported) {
      return;
    }

    this.initialize();

    try {
      await this.autoUpdater.checkForUpdates();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logs.write('error', 'updater', 'Failed to start update check', { error: message });
      this.setState({
        status: 'error',
        downloadPercent: null,
        error: message
      });
      throw error;
    }
  }

  installUpdate(): void {
    if (!this.autoUpdatesSupported || this.state.status !== 'downloaded') {
      return;
    }

    this.logs.write('info', 'updater', 'Installing downloaded update', {
      version: this.state.availableVersion
    });
    this.autoUpdater.quitAndInstall();
  }

  private setStateFromProgress(progress: ProgressInfo): void {
    this.setState({
      status: 'downloading',
      downloadPercent: Math.max(0, Math.min(100, Number(progress.percent.toFixed(1)))),
      error: null
    });
  }

  private setState(patch: Partial<UpdaterState>): void {
    this.state = {
      ...this.state,
      ...patch
    };

    for (const listener of this.listeners) {
      listener();
    }
  }
}

export type {
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
  UpdaterClient
};
