import type Database from 'better-sqlite3';
import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../db/database.js';
import { IPC_CHANNELS } from '../shared/ipc.js';
import { settingsPatchSchema } from '../shared/schemas.js';
import { ChannelRepository } from '../modules/channels/channel-repository.js';
import { ChannelService } from '../modules/channels/channel-service.js';
import { LiveSessionRepository } from '../modules/live-sessions/live-session-repository.js';
import { LiveSessionService } from '../modules/live-sessions/live-session-service.js';
import { LogService } from '../modules/logging/log-service.js';
import { PollRunRepository } from '../modules/polling/poll-run-repository.js';
import { PollingService } from '../modules/polling/polling-service.js';
import { SettingsService } from '../modules/settings/settings-service.js';
import { StateHub } from './state-hub.js';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const preloadPath = join(currentDir, '../preload/index.js');

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
  readonly stateHub: StateHub;

  constructor() {
    this.db = createDatabase();
    this.logs = new LogService(this.db);
    this.settings = new SettingsService(this.db);
    this.channels = new ChannelRepository(this.db);
    this.channelService = new ChannelService(this.channels, this.settings, this.logs);
    this.sessionsRepository = new LiveSessionRepository(this.db);
    this.sessions = new LiveSessionService(this.sessionsRepository, this.logs, preloadPath);
    this.pollRuns = new PollRunRepository(this.db);
    this.stateHub = new StateHub();
    this.polling = new PollingService(
      this.channels,
      this.channelService,
      this.sessions,
      this.pollRuns,
      this.settings,
      this.logs
    );
    this.polling.bindStateChange(() => this.stateHub.emit());
  }

  registerIpc(mainWindow: BrowserWindow): void {
    ipcMain.handle(IPC_CHANNELS.channelsList, () => this.channels.list());
    ipcMain.handle(IPC_CHANNELS.channelsCreate, (_event, input) => {
      const result = this.channelService.create(input);
      this.stateHub.emit();
      return result;
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

    ipcMain.handle(IPC_CHANNELS.settingsGet, () => this.settings.get());
    ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, patch) => {
      const result = this.settings.update(settingsPatchSchema.parse(patch));
      this.stateHub.emit();
      return result;
    });

    ipcMain.handle(IPC_CHANNELS.livesList, () => this.sessions.list());
    ipcMain.handle(IPC_CHANNELS.livesActivate, (_event, sessionId) => {
      this.sessions.activate(sessionId);
      this.stateHub.emit();
    });
    ipcMain.handle(IPC_CHANNELS.livesClose, async (_event, sessionId) => {
      await this.sessions.close(sessionId);
      this.stateHub.emit();
    });
    ipcMain.handle(IPC_CHANNELS.logsList, () => this.logs.list());
    ipcMain.handle(IPC_CHANNELS.appSnapshot, async () => ({
      channels: this.channels.list(),
      sessions: this.sessions.list(),
      settings: this.settings.get(),
      logs: this.logs.list()
    }));

    this.stateHub.on(() => {
      mainWindow.webContents.send(IPC_CHANNELS.appStateChanged);
    });
  }
}
