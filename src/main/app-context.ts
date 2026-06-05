import type Database from 'better-sqlite3';
import * as electron from 'electron';
import type { BrowserWindow } from 'electron';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDatabase, resolveDatabasePath } from '../db/database.js';
import { PLATFORM_LOGIN, PLATFORM_PARTITIONS } from '../shared/constants.js';
import { IPC_CHANNELS } from '../shared/ipc.js';
import { channelTransferListSchema, settingsPatchSchema } from '../shared/schemas.js';
import type { Platform, PlatformAuthStatus, ShutdownState } from '../shared/types.js';
import { ChannelRepository } from '../modules/channels/channel-repository.js';
import { ChannelService, ChannelValidationError } from '../modules/channels/channel-service.js';
import { LiveSessionRepository } from '../modules/live-sessions/live-session-repository.js';
import { LiveSessionService } from '../modules/live-sessions/live-session-service.js';
import { LogService } from '../modules/logging/log-service.js';
import { PollRunRepository } from '../modules/polling/poll-run-repository.js';
import { PollingService } from '../modules/polling/polling-service.js';
import { SettingsService } from '../modules/settings/settings-service.js';
import { StateHub } from './state-hub.js';
import { UpdaterService } from './updater-service.js';

const { app, dialog, ipcMain, shell } = electron;
const preloadPath = join(__dirname, '../preload/index.js');
const CACHE_DIRECTORIES = ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache'] as const;
const SERVICE_WORKER_CACHE_DIRECTORIES = [join('Service Worker', 'CacheStorage'), join('Service Worker', 'ScriptCache')] as const;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapChannelCreateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('already being tracked')) {
    return 'This channel is already being tracked.';
  }
  if (normalized.includes('readonly')) {
    return 'The local database is read-only. Check folder permissions or move the app out of a protected location.';
  }
  if (normalized.includes('locked') || normalized.includes('busy')) {
    return 'The local database is locked by another process. Close other Lurk Buddy instances and try again.';
  }

  return 'Failed to save this channel locally.';
}

export class AppContext {
  readonly db: Database.Database;
  readonly logs: LogService;
  readonly settings: SettingsService;
  readonly channels: ChannelRepository;
  readonly channelService: ChannelService;
  readonly sessionsRepository: LiveSessionRepository;
  readonly sessions: LiveSessionService;
  readonly pollRuns: PollRunRepository;
  readonly polling: PollingService;
  readonly updater: UpdaterService;
  readonly stateHub: StateHub;
  private shutdownState: ShutdownState = { status: 'idle', detail: null };
  private shutdownPromise: Promise<void> | null = null;

  constructor() {
    this.db = createDatabase();
    this.logs = new LogService(this.db);
    this.settings = new SettingsService(this.db);
    this.channels = new ChannelRepository(this.db);
    this.channelService = new ChannelService(this.channels, this.logs);
    this.sessionsRepository = new LiveSessionRepository(this.db);
    this.sessions = new LiveSessionService(this.sessionsRepository, this.logs, preloadPath, this.settings);
    this.pollRuns = new PollRunRepository(this.db);
    this.stateHub = new StateHub();
    this.updater = new UpdaterService(this.logs);
    this.polling = new PollingService(
      this.channels,
      this.channelService,
      this.sessions,
      this.pollRuns,
      this.settings,
      this.logs
    );
    this.sessions.bindStateChange(() => this.stateHub.emit());
    this.polling.bindStateChange(() => this.stateHub.emit());
    this.updater.onStateChange(() => this.stateHub.emit());
  }

  registerIpc(mainWindow: BrowserWindow): void {
    ipcMain.handle(IPC_CHANNELS.channelsList, () => this.channels.list());
    ipcMain.handle(IPC_CHANNELS.channelsCreate, async (_event, input) => {
      try {
        const result = await this.channelService.create(input);
        this.stateHub.emit();
        return result;
      } catch (error) {
        if (error instanceof ChannelValidationError) {
          // User input problem, not a storage failure — surface the message as-is.
          throw new Error(error.message);
        }
        const dbPath = resolveDatabasePath();
        this.logs.write('error', 'channels', 'Failed to create channel', {
          input,
          dbPath,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new Error(mapChannelCreateError(error));
      }
    });
    ipcMain.handle(IPC_CHANNELS.channelsUpdate, (_event, id, patch) => {
      const result = this.channelService.update(id, patch);
      this.stateHub.emit();
      return result;
    });
    ipcMain.handle(IPC_CHANNELS.channelsDelete, (_event, id) => {
      this.channelService.delete(id);
      this.stateHub.emit();
    });
    ipcMain.handle(IPC_CHANNELS.channelsToggle, (_event, id, enabled) => {
      const result = this.channelService.toggle(id, enabled);
      this.stateHub.emit();
      return result;
    });
    ipcMain.handle(IPC_CHANNELS.channelsTest, (_event, id) => this.channelService.test(id));
    ipcMain.handle(IPC_CHANNELS.channelsExport, async () => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export channel list',
        defaultPath: join(app.getPath('documents'), 'lurk-buddy-channels.json'),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (result.canceled || !result.filePath) {
        return { path: null, count: 0 };
      }

      const payload = this.channelService.exportItems();
      await writeFile(result.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      this.logs.write('info', 'channels', 'Channels exported', {
        count: payload.length,
        path: result.filePath
      });
      return { path: result.filePath, count: payload.length };
    });
    ipcMain.handle(IPC_CHANNELS.channelsImport, async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import channel list',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { path: null, total: 0, imported: 0, skipped: 0 };
      }

      const filePath = result.filePaths[0];
      const raw = await readFile(filePath, 'utf8');
      const parsed = channelTransferListSchema.parse(JSON.parse(raw));
      const summary = await this.channelService.importItems(parsed);
      this.stateHub.emit();
      return { path: filePath, ...summary };
    });

    ipcMain.handle(IPC_CHANNELS.settingsGet, () => this.settings.get());
    ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, patch) => {
      const result = this.settings.update(settingsPatchSchema.parse(patch));
      this.sessions.refreshNetworkPolicies();
      this.stateHub.emit();
      return result;
    });

    ipcMain.handle(IPC_CHANNELS.livesList, () => this.sessions.activeList());
    ipcMain.handle(IPC_CHANNELS.livesActivate, async (_event, sessionId) => {
      await this.sessions.activate(sessionId);
      this.stateHub.emit();
    });
    ipcMain.handle(IPC_CHANNELS.livesSetMuted, (_event, sessionId, muted) => {
      this.sessions.setMuted(sessionId, muted);
      this.stateHub.emit();
    });
    ipcMain.handle(IPC_CHANNELS.livesLayout, (_event, sessionId, bounds) => {
      this.sessions.updateLayout(sessionId, bounds);
    });
    ipcMain.handle(IPC_CHANNELS.livesClose, async (_event, sessionId) => {
      await this.sessions.close(sessionId);
      this.stateHub.emit();
    });
    ipcMain.handle(IPC_CHANNELS.livesReload, async (_event, sessionId) => {
      await this.sessions.reload(sessionId);
      this.stateHub.emit();
    });
    ipcMain.handle(IPC_CHANNELS.livesOpen, async (_event, channelId) => {
      const channel = this.channels.getById(channelId);
      if (!channel) {
        return null;
      }
      const session = await this.sessions.openManually(channel);
      this.stateHub.emit();
      return session;
    });
    ipcMain.handle(IPC_CHANNELS.logsList, () => this.logs.list());
    ipcMain.handle(IPC_CHANNELS.appSnapshot, async () => ({
      channels: this.channels.list(),
      sessions: this.sessions.activeList(),
      authStatus: await this.computePlatformAuthStatus(),
      settings: this.settings.get(),
      updater: this.updater.getState(),
      logs: this.logs.list(),
      pollingRunning: this.polling.isRunning(),
      pollingChannelId: this.polling.currentChannelId(),
      currentPollingChannelIds: this.polling.currentChannelIds(),
      pollingRetryAttempts: this.polling.retryAttemptEntries(),
      timedOutChannelIds: this.polling.timedOutChannelIds(),
      completedPollingChannelIds: this.polling.completedChannelIds(),
      shutdown: this.shutdownState
    }));
    ipcMain.handle(IPC_CHANNELS.appUpdaterState, () => this.updater.getState());
    ipcMain.handle(IPC_CHANNELS.appShutdownState, () => this.shutdownState);

    ipcMain.handle(IPC_CHANNELS.appRunNow, async () => {
      await this.polling.runNow();
    });
    ipcMain.handle(IPC_CHANNELS.appCheckForUpdates, async () => {
      await this.updater.checkForUpdates();
    });
    ipcMain.handle(IPC_CHANNELS.appInstallUpdate, () => {
      this.updater.installUpdate();
    });
    ipcMain.handle(IPC_CHANNELS.appOpenLatestRelease, async () => {
      await shell.openExternal(this.updater.getState().releaseUrl);
    });

    const unsubscribeStateHub = this.stateHub.on(() => {
      if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send(IPC_CHANNELS.appStateChanged);
    });

    mainWindow.once('closed', () => {
      unsubscribeStateHub();
    });
  }

  private async computePlatformAuthStatus(): Promise<PlatformAuthStatus> {
    const status: PlatformAuthStatus = {};
    await Promise.all(
      (Object.entries(PLATFORM_LOGIN) as Array<[Platform, { url: string; cookie: string }]>).map(
        async ([platform, cfg]) => {
          try {
            const partitionSession = electron.session.fromPartition(PLATFORM_PARTITIONS[platform]);
            const cookies = await partitionSession.cookies.get({ url: cfg.url, name: cfg.cookie });
            status[platform] = cookies.length > 0;
          } catch {
            status[platform] = false;
          }
        }
      )
    );
    return status;
  }

  beginShutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownState = {
      status: 'cleaning-cache',
      detail: 'Cleaning cache before closing...'
    };
    this.stateHub.emit();

    this.shutdownPromise = (async () => {
      this.polling.stop();
      await wait(140);
      await this.sessions.prepareForAppShutdown();
      await this.clearBrowserCaches();
      this.logs.write('info', 'app', 'Finished cache cleanup during app shutdown');
    })().catch((error) => {
      this.logs.write('error', 'app', 'Cache cleanup failed during app shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
    });

    return this.shutdownPromise;
  }

  private async clearBrowserCaches(): Promise<void> {
    const partitions = Object.values(PLATFORM_PARTITIONS).map((partition) => electron.session.fromPartition(partition));
    const sessionsToClear = [electron.session.defaultSession, ...partitions];

    await Promise.allSettled(
      sessionsToClear.map(async (browserSession) => {
        await browserSession.clearCache();
      })
    );

    const userDataPath = app.getPath('userData');
    const removalTargets = [
      ...CACHE_DIRECTORIES.map((directory) => join(userDataPath, directory))
    ];

    const partitionsRoot = join(userDataPath, 'Partitions');
    const partitionEntries = await readdir(partitionsRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of partitionEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      for (const directory of CACHE_DIRECTORIES) {
        removalTargets.push(join(partitionsRoot, entry.name, directory));
      }

      for (const directory of SERVICE_WORKER_CACHE_DIRECTORIES) {
        removalTargets.push(join(partitionsRoot, entry.name, directory));
      }
    }

    await Promise.allSettled(
      removalTargets.map(async (target) => {
        await rm(target, { recursive: true, force: true, maxRetries: 3 });
      })
    );
  }
}
