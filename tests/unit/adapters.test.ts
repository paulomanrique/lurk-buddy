import { describe, expect, it } from 'vitest';
import { adapters } from '../../src/platforms/index';

describe('platform adapters', () => {
  it('normalizes twitch input', () => {
    expect(adapters.twitch.normalizeInput('https://twitch.tv/some_channel')).toMatchObject({
      channelKey: 'some_channel',
      url: 'https://www.twitch.tv/some_channel'
    });
  });

  it('normalizes youtube handles', () => {
    expect(adapters.youtube.normalizeInput('@lurkbuddy')).toMatchObject({
      channelKey: '@lurkbuddy',
      url: 'https://www.youtube.com/@lurkbuddy'
    });
  });

  it('normalizes kick input', () => {
    expect(adapters.kick.normalizeInput('kick.com/streamer')).toMatchObject({
      channelKey: 'streamer',
      url: 'https://kick.com/streamer'
    });
  });
});
