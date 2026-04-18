import { describe, expect, it } from 'vitest';
import { BasePlatformAdapter, type NormalizedChannel } from '../../src/platforms/base';
import { adapters } from '../../src/platforms/index';

class TestAdapter extends BasePlatformAdapter {
  readonly platform = 'twitch' as const;

  normalizeInput(): NormalizedChannel {
    return {
      channelKey: 'test',
      displayName: 'test',
      url: 'https://www.twitch.tv/test'
    };
  }
}

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

  it('does not treat a loading media element as an ended live session', async () => {
    let script = '';
    const adapter = new TestAdapter();
    await adapter.extractPlaybackState({
      executeJavaScript: (value: string) => {
        script = value;
        return Promise.resolve({
          playerDetected: true,
          pageClaimsFocused: true,
          pageClaimsVisible: true,
          siteMuted: false,
          containerMuted: false,
          ended: false
        });
      }
    } as never);

    expect(script).toContain('media.ended');
    expect(script).not.toContain('readyState === 0');
  });
});
