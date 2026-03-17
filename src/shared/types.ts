export type Platform = 'twitch' | 'youtube' | 'kick';

export type SessionStatus = 'opening' | 'live' | 'ending' | 'closed' | 'error' | 'queued';

export interface Channel {
  id: string;
  platform: Platform;
  channelKey: string;
  displayName: string;
  url: string;
  enabled: boolean;
  pollIntervalMinutes: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
  lastPollAt: string | null;
}

export interface LiveSession {
  id: string;
  channelId: string;
  platform: Platform;
  status: SessionStatus;
  openedAt: string;
  closedAt: string | null;
  lastHeartbeatAt: string | null;
  tabId: string;
  streamUrl: string;
  lastDetectedTitle: string | null;
  lastError: string | null;
  containerMuted?: boolean;
}

export interface AppSettings {
  maxConcurrentLives: number;
  defaultPollIntervalMinutes: number;
  startOnLogin: boolean;
  minimizeToTray: boolean;
  autoOpenLives: boolean;
  closeGracePeriodSeconds: number;
  enableFocusSpoof: boolean;
  enablePerTabMute: boolean;
  enableLowBandwidthBackgroundLives: boolean;
}

export interface ChannelStatus {
  isLive: boolean;
  watchUrl?: string;
  allWatchUrls?: string[];
  title?: string;
  viewerCount?: number | null;
  thumbnailUrl?: string | null;
  raw?: unknown;
}

export interface PlaybackState {
  playerDetected: boolean;
  pageClaimsFocused: boolean;
  pageClaimsVisible: boolean;
  siteMuted: boolean | null;
  containerMuted: boolean;
  ended: boolean;
  errorMessage?: string | null;
}

export interface EventLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  metadata: string | null;
  createdAt: string;
}

export interface PollRun {
  id: string;
  channelId: string;
  status: 'live' | 'offline' | 'error';
  detail: string | null;
  createdAt: string;
}

export interface CreateChannelInput {
  platform?: Platform;
  value: string;
  displayName?: string;
  pollIntervalMinutes?: number;
  priority?: number;
}

export interface ChannelTransferItem {
  platform?: Platform;
  value: string;
  displayName?: string;
  enabled?: boolean;
  pollIntervalMinutes?: number;
  priority?: number;
}

export interface ExportChannelsResult {
  path: string | null;
  count: number;
}

export interface ImportChannelsResult {
  path: string | null;
  total: number;
  imported: number;
  skipped: number;
}

export interface UpdateChannelInput {
  displayName?: string;
  enabled?: boolean;
  pollIntervalMinutes?: number;
  priority?: number;
}

export interface RendererSnapshot {
  channels: Channel[];
  sessions: LiveSession[];
  settings: AppSettings;
  logs: EventLog[];
}

export interface TestChannelResult {
  normalizedUrl: string;
  status: ChannelStatus;
}

export interface LiveViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
