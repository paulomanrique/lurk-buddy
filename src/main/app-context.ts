import type Database from 'better-sqlite3';
import * as electron from 'electron';
import type { BrowserWindow } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDatabase } from '../db/database.js';
import { IPC_CHANNELS } from '../shared/ipc.js';
import { channelTransferListSchema, settingsPatchSchema } from '../shared/schemas.js';
import { ChannelRepository } from '../modules/channels/channel-repository.js';
import { ChannelService } from '../modules/channels/channel-service.js';
import { LiveSessionRepository } from '../modules/live-sessions/live-session-repository.js';
import { LiveSessionService } from '../modules/live-sessions/live-session-service.js';
import { LogService } from '../modules/logging/log-service.js';
import { PollRunRepository } from '../modules/polling/poll-run-repository.js';
import { PollingService } from '../modules/polling/polling-service.js';
import { SettingsService } from '../modules/settings/settings-service.js';
import { StateHub } from './state-hub.js';

const { app, dialog, ipcMain } = electron;
const preloadPath = join(__dirname, '../preload/index.js');

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
    this.sessions = new LiveSessionService(this.sessionsRepository, this.logs, preloadPath, this.settings);
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
    this.sessions.bindStateChange(() => this.stateHub.emit());
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
      const summary = this.channelService.importItems(parsed);
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
    ipcMain.handle(IPC_CHANNELS.logsList, () => this.logs.list());
    ipcMain.handle(IPC_CHANNELS.appSnapshot, async () => ({
      channels: this.channels.list(),
      sessions: this.sessions.activeList(),
      settings: this.settings.get(),
      logs: this.logs.list(),
      pollingRunning: this.polling.isRunning()
    }));

    ipcMain.handle(IPC_CHANNELS.appRunNow, async () => {
      await this.polling.runNow();
    });

    this.stateHub.on(() => {
      mainWindow.webContents.send(IPC_CHANNELS.appStateChanged);
    });
  }
}
