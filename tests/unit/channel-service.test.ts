import { describe, expect, it, vi } from 'vitest';
import { ChannelService } from '../../src/modules/channels/channel-service';

describe('ChannelService', () => {
  it('rejects duplicate tracked channels before hitting sqlite', () => {
    const repository = {
      list: vi.fn(() => []),
      getByPlatformAndChannelKey: vi.fn(() => ({
        id: 'existing',
        platform: 'twitch',
        channelKey: 'some_channel',
        displayName: 'some_channel',
        url: 'https://www.twitch.tv/some_channel',
        enabled: true,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
        lastPollAt: null
      })),
      save: vi.fn()
    };
    const logs = { write: vi.fn() };
    const service = new ChannelService(repository as never, logs as never);

    expect(() => service.create({ value: 'https://twitch.tv/some_channel' })).toThrow(
      'This channel is already being tracked.'
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
