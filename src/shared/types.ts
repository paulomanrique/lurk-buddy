export type Platform = 'twitch' | 'youtube' | 'kick' | 'tiktok' | 'instagram' | 'twitter';

export type SessionStatus = 'opening' | 'live' | 'ending' | 'closed' | 'error' | 'queued' | 'recovering';

export interface Channel {
  id: string;
  platform: Platform;
  channelKey: string;
  displayName: string;
  url: string;
  enabled: boolean;
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
  startOnLogin: boolean;
  minimizeToTray: boolean;
  autoOpenLives: boolean;
  closeGracePeriodSeconds: number;
  enableFocusSpoof: boolean;
  enablePerTabMute: boolean;
  enableLowBandwidthBackgroundLives: boolean;
}

export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

export interface UpdaterState {
  enabled: boolean;
  status: UpdaterStatus;
  currentVersion: string;
  availableVersion: string | null;
  downloadPercent: number | null;
  error: string | null;
  manualReason: string | null;
  releaseUrl: string;
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
}

export interface ChannelTransferItem {
  platform?: Platform;
  value: string;
  displayName?: string;
  enabled?: boolean;
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
}

export type PlatformAuthStatus = Partial<Record<Platform, boolean>>;

export interface RendererSnapshot {
  channels: Channel[];
  sessions: LiveSession[];
  authStatus: PlatformAuthStatus;
  settings: AppSettings;
  updater: UpdaterState;
  logs: EventLog[];
  pollingRunning: boolean;
  pollingChannelId: string | null;
  currentPollingChannelIds: string[];
  pollingRetryAttempts: Record<string, number>;
  timedOutChannelIds: string[];
  completedPollingChannelIds: string[];
  shutdown: ShutdownState;
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

export type ShutdownStatus = 'idle' | 'cleaning-cache';

export interface ShutdownState {
  status: ShutdownStatus;
  detail: string | null;
}
