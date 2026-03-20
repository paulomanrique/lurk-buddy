import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';
import { useAppStore } from '../../src/renderer/store';

const snapshot = {
  channels: [],
  sessions: [],
  settings: {
    maxConcurrentLives: 12,
    startOnLogin: false,
    minimizeToTray: false,
    autoOpenLives: true,
    closeGracePeriodSeconds: 90,
    enableFocusSpoof: true,
    enablePerTabMute: true,
    enableLowBandwidthBackgroundLives: false
  },
  updater: {
    enabled: true,
    status: 'idle' as const,
    currentVersion: '1.0.0',
    availableVersion: null,
    downloadPercent: null,
    error: null
  },
  logs: [],
  pollingRunning: false,
  pollingChannelId: null,
  completedPollingChannelIds: []
};

const lurkBuddy = {
  channels: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggle: vi.fn(),
    test: vi.fn(),
    export: vi.fn(),
    import: vi.fn()
  },
  settings: {
    get: vi.fn(),
    update: vi.fn()
  },
  lives: {
    list: vi.fn(),
    activate: vi.fn(),
    close: vi.fn(),
    setMuted: vi.fn(),
    layout: vi.fn()
  },
  logs: {
    list: vi.fn()
  },
  app: {
    snapshot: vi.fn(),
    updaterState: vi.fn(),
    onStateChanged: vi.fn(() => vi.fn()),
    runNow: vi.fn(),
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn()
  }
};

Object.defineProperty(window, 'lurkBuddy', {
  value: lurkBuddy
});

describe('App shell', () => {
  beforeEach(() => {
    useAppStore.setState({
      channels: [],
      sessions: [],
      settings: null,
      updater: null,
      logs: [],
      initialized: false,
      pollingRunning: false,
      pollingChannelId: null,
      completedPollingChannelIds: [],
      selectedSessionId: null,
      panelOnly: false,
      loading: true
    });
    lurkBuddy.app.snapshot.mockResolvedValue(snapshot);
  });

  it('renders the brand title', async () => {
    render(<App />);
    expect(await screen.findByAltText('Lurk Buddy')).toBeInTheDocument();
  });

  it('renders updater status and check action', async () => {
    render(<App />);

    expect(await screen.findByText('v1.0.0 current')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'check_updates' })).toBeInTheDocument();
  });

  it('renders restart action when an update is downloaded', async () => {
    lurkBuddy.app.snapshot.mockResolvedValueOnce({
      ...snapshot,
      updater: {
        ...snapshot.updater,
        status: 'downloaded',
        availableVersion: '1.1.0',
        downloadPercent: 100
      }
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: 'restart_to_update' })).toBeInTheDocument();
    expect(screen.getByText('v1.1.0 ready')).toBeInTheDocument();
  });
});
