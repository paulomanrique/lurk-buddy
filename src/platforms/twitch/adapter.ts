import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';

export class TwitchAdapter extends BasePlatformAdapter {
  readonly platform = 'twitch' as const;

  normalizeInput(input: string): NormalizedChannel {
    const value = input.trim().replace(/^@/, '');
    const channelKey = value
      .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '')
      .replace(/\/+$/, '')
      .split('/')[0];
    return {
      channelKey,
      url: `https://www.twitch.tv/${channelKey}`,
      displayName: channelKey
    };
  }
}
