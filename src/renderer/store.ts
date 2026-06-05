import { create } from 'zustand';
import type { AppSettings, Channel, EventLog, LiveSession, PlatformAuthStatus, ShutdownState, UpdaterState } from '@shared/types';

interface AppState {
  channels: Channel[];
  sessions: LiveSession[];
  authStatus: PlatformAuthStatus;
  settings: AppSettings | null;
  updater: UpdaterState | null;
  logs: EventLog[];
  initialized: boolean;
  pollingRunning: boolean;
  pollingChannelId: string | null;
  currentPollingChannelIds: string[];
  pollingRetryAttempts: Record<string, number>;
  timedOutChannelIds: string[];
  completedPollingChannelIds: string[];
  selectedSessionId: string | null;
  panelOnly: boolean;
  loading: boolean;
  shutdown: ShutdownState;
  hydrate: () => Promise<void>;
  setSelectedSessionId: (sessionId: string | null) => void;
  setPanelOnly: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  channels: [],
  sessions: [],
  authStatus: {},
  settings: null,
  updater: null,
  logs: [],
  initialized: false,
  pollingRunning: false,
  pollingChannelId: null,
  currentPollingChannelIds: [],
  pollingRetryAttempts: {},
  timedOutChannelIds: [],
  completedPollingChannelIds: [],
  selectedSessionId: null,
  panelOnly: false,
  loading: true,
  shutdown: { status: 'idle', detail: null },
  hydrate: async () => {
    if (!get().initialized) {
      set({ loading: true });
    }
    const snapshot = await window.lurkBuddy.app.snapshot();
    const previousSelectedSessionId = get().selectedSessionId;
    const selectedSessionId = previousSelectedSessionId && snapshot.sessions.some((session) => session.id === previousSelectedSessionId)
      ? previousSelectedSessionId
      : null;
    set({
      channels: snapshot.channels,
      sessions: snapshot.sessions,
      authStatus: snapshot.authStatus,
      settings: snapshot.settings,
      updater: snapshot.updater,
      logs: snapshot.logs,
      initialized: true,
      pollingRunning: snapshot.pollingRunning,
      pollingChannelId: snapshot.pollingChannelId,
      currentPollingChannelIds: snapshot.currentPollingChannelIds,
      pollingRetryAttempts: snapshot.pollingRetryAttempts,
      timedOutChannelIds: snapshot.timedOutChannelIds,
      completedPollingChannelIds: snapshot.completedPollingChannelIds,
      shutdown: snapshot.shutdown,
      selectedSessionId,
      loading: false
    });
  },
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
  setPanelOnly: (panelOnly) => set({ panelOnly })
}));
