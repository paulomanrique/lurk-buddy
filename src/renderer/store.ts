import { create } from 'zustand';
import type { AppSettings, Channel, EventLog, LiveSession } from '@shared/types';

interface AppState {
  channels: Channel[];
  sessions: LiveSession[];
  settings: AppSettings | null;
  logs: EventLog[];
  initialized: boolean;
  pollingRunning: boolean;
  pollingChannelId: string | null;
  completedPollingChannelIds: string[];
  selectedSessionId: string | null;
  panelOnly: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  setSelectedSessionId: (sessionId: string | null) => void;
  setPanelOnly: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  channels: [],
  sessions: [],
  settings: null,
  logs: [],
  initialized: false,
  pollingRunning: false,
  pollingChannelId: null,
  completedPollingChannelIds: [],
  selectedSessionId: null,
  panelOnly: false,
  loading: true,
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
      settings: snapshot.settings,
      logs: snapshot.logs,
      initialized: true,
      pollingRunning: snapshot.pollingRunning,
      pollingChannelId: snapshot.pollingChannelId,
      completedPollingChannelIds: snapshot.completedPollingChannelIds,
      selectedSessionId,
      loading: false
    });
  },
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
  setPanelOnly: (panelOnly) => set({ panelOnly })
}));
