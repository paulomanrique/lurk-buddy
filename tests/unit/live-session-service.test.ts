import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel, LiveSession } from '../../src/shared/types';

const electronMock = vi.hoisted(() => {
  const loadURL = vi.fn(() => new Promise<void>(() => {}));
  const webContents = {
    close: vi.fn(),
    debugger: {
      attach: vi.fn(),
      isAttached: vi.fn(() => true),
      on: vi.fn(),
      sendCommand: vi.fn(() => Promise.resolve())
    },
    getURL: vi.fn(() => ''),
    isDestroyed: vi.fn(() => false),
    loadURL,
    on: vi.fn(),
    setAudioMuted: vi.fn(),
    setWindowOpenHandler: vi.fn()
  };
  const view = {
    setBackgroundColor: vi.fn(),
    setBounds: vi.fn(),
    setVisible: vi.fn(),
    webContents
  };
  const permissionSession = {
    setPermissionRequestHandler: vi.fn()
  };

  return {
    loadURL,
    permissionSession,
    view,
    WebContentsView: vi.fn(() => view),
    session: {
      fromPartition: vi.fn(() => permissionSession)
    }
  };
});

vi.mock('electron', () => electronMock);

describe('LiveSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not wait for the stream page to finish loading before returning the opening session', async () => {
    const { LiveSessionService } = await import('../../src/modules/live-sessions/live-session-service');
    const savedSessions: LiveSession[] = [];
    const repository = {
      getActive: vi.fn(() => savedSessions.filter((session) => ['opening', 'live', 'queued', 'ending', 'recovering'].includes(session.status))),
      getAllActiveByChannelId: vi.fn(),
      getByChannelAndUrl: vi.fn(() => null),
      getByChannelId: vi.fn(),
      getById: vi.fn((sessionId: string) => savedSessions.find((session) => session.id === sessionId) ?? null),
      list: vi.fn(() => savedSessions),
      save: vi.fn((session: LiveSession) => {
        savedSessions.push(session);
        return session;
      }),
      update: vi.fn((session: LiveSession) => {
        const index = savedSessions.findIndex((entry) => entry.id === session.id);
        if (index >= 0) savedSessions[index] = session;
        return session;
      })
    };
    const service = new LiveSessionService(
      repository as never,
      { write: vi.fn() } as never,
      '/tmp/preload.js',
      { get: vi.fn(() => ({ enableLowBandwidthBackgroundLives: false })) } as never
    );
    service.attachWindow({
      contentView: {
        addChildView: vi.fn(),
        removeChildView: vi.fn()
      }
    } as never);

    const channel: Channel = {
      id: 'channel-1',
      platform: 'twitch',
      channelKey: 'some_channel',
      displayName: 'some_channel',
      url: 'https://www.twitch.tv/some_channel',
      enabled: true,
      createdAt: '2026-04-18T00:00:00.000Z',
      updatedAt: '2026-04-18T00:00:00.000Z',
      lastPollAt: null
    };

    const result = await Promise.race([
      service.ensureSession(channel, channel.url),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 0))
    ]);

    expect(result).not.toBe('blocked');
    expect(result).toMatchObject({
      channelId: channel.id,
      status: 'opening',
      streamUrl: channel.url
    });
    expect(electronMock.loadURL).toHaveBeenCalledWith(channel.url);
  });
});
