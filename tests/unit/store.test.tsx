import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';

const snapshot = {
  channels: [],
  sessions: [],
  settings: {
    maxConcurrentLives: 12,
    defaultPollIntervalMinutes: 5,
    startOnLogin: false,
    minimizeToTray: false,
    autoOpenLives: true,
    closeGracePeriodSeconds: 90,
    enableFocusSpoof: true,
    enablePerTabMute: true
  },
  logs: []
};

Object.defineProperty(window, 'lurkBuddy', {
  value: {
    channels: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      toggle: vi.fn(),
      test: vi.fn()
    },
    settings: {
      get: vi.fn(),
      update: vi.fn()
    },
    lives: {
      list: vi.fn(),
      activate: vi.fn(),
      close: vi.fn()
    },
    logs: {
      list: vi.fn()
    },
    app: {
      snapshot: vi.fn().mockResolvedValue(snapshot),
      onStateChanged: vi.fn(() => vi.fn())
    }
  }
});

describe('App shell', () => {
  it('renders the brand title', async () => {
    render(<App />);
    expect(await screen.findByText('Lurk Buddy')).toBeInTheDocument();
  });
});
