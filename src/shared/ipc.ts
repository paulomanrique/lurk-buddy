import type {
  AppSettings,
  Channel,
  ChannelTransferItem,
  CreateChannelInput,
  EventLog,
  ExportChannelsResult,
  ImportChannelsResult,
  LiveViewBounds,
  LiveSession,
  RendererSnapshot,
  TestChannelResult,
  UpdaterState,
  UpdateChannelInput
} from './types.js';

export interface LurkBuddyApi {
  channels: {
    list: () => Promise<Channel[]>;
    create: (input: CreateChannelInput) => Promise<Channel>;
    update: (id: string, patch: UpdateChannelInput) => Promise<Channel>;
    delete: (id: string) => Promise<void>;
    toggle: (id: string, enabled: boolean) => Promise<Channel>;
    test: (id: string) => Promise<TestChannelResult>;
    export: () => Promise<ExportChannelsResult>;
    import: () => Promise<ImportChannelsResult>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  };
  lives: {
    list: () => Promise<LiveSession[]>;
    activate: (sessionId: string) => Promise<void>;
    close: (sessionId: string) => Promise<void>;
    setMuted: (sessionId: string, muted: boolean) => Promise<void>;
    layout: (sessionId: string | null, bounds: LiveViewBounds | null) => Promise<void>;
  };
  logs: {
    list: () => Promise<EventLog[]>;
  };
  app: {
    snapshot: () => Promise<RendererSnapshot>;
    updaterState: () => Promise<UpdaterState>;
    onStateChanged: (callback: () => void) => () => void;
    runNow: () => Promise<void>;
    checkForUpdates: () => Promise<void>;
    installUpdate: () => Promise<void>;
    openLatestRelease: () => Promise<void>;
  };
}

export const IPC_CHANNELS = {
  channelsList: 'channels:list',
  channelsCreate: 'channels:create',
  channelsUpdate: 'channels:update',
  channelsDelete: 'channels:delete',
  channelsToggle: 'channels:toggle',
  channelsTest: 'channels:test',
  channelsExport: 'channels:export',
  channelsImport: 'channels:import',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  livesList: 'lives:list',
  livesActivate: 'lives:activate',
  livesClose: 'lives:close',
  livesSetMuted: 'lives:set-muted',
  livesLayout: 'lives:layout',
  logsList: 'logs:list',
  appSnapshot: 'app:snapshot',
  appUpdaterState: 'app:updater-state',
  appStateChanged: 'app:state-changed',
  appRunNow: 'app:run-now',
  appCheckForUpdates: 'app:check-for-updates',
  appInstallUpdate: 'app:install-update',
  appOpenLatestRelease: 'app:open-latest-release'
} as const;
