import { create } from 'zustand';
import type { AppSettings, Channel, EventLog, LiveSession } from '@shared/types';

interface AppState {
  channels: Channel[];
  sessions: LiveSession[];
  settings: AppSettings | null;
  logs: EventLog[];
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
  selectedSessionId: null,
  panelOnly: false,
  loading: true,
  hydrate: async () => {
    set({ loading: true });
    const snapshot = await window.lurkBuddy.app.snapshot();
    set({
      channels: snapshot.channels,
      sessions: snapshot.sessions,
      settings: snapshot.settings,
      logs: snapshot.logs,
      selectedSessionId: get().selectedSessionId ?? snapshot.sessions[0]?.id ?? null,
      loading: false
    });
  },
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
  setPanelOnly: (panelOnly) => set({ panelOnly })
}));
