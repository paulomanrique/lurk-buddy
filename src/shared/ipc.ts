import type {
  AppSettings,
  Channel,
  CreateChannelInput,
  EventLog,
  LiveViewBounds,
  LiveSession,
  TestChannelResult,
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
    snapshot: () => Promise<{
      channels: Channel[];
      sessions: LiveSession[];
      settings: AppSettings;
      logs: EventLog[];
    }>;
    onStateChanged: (callback: () => void) => () => void;
  };
}

export const IPC_CHANNELS = {
  channelsList: 'channels:list',
  channelsCreate: 'channels:create',
  channelsUpdate: 'channels:update',
  channelsDelete: 'channels:delete',
  channelsToggle: 'channels:toggle',
  channelsTest: 'channels:test',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  livesList: 'lives:list',
  livesActivate: 'lives:activate',
  livesClose: 'lives:close',
  livesSetMuted: 'lives:set-muted',
  livesLayout: 'lives:layout',
  logsList: 'logs:list',
  appSnapshot: 'app:snapshot',
  appStateChanged: 'app:state-changed'
} as const;
