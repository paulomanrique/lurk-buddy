import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';

export class KickAdapter extends BasePlatformAdapter {
  readonly platform = 'kick' as const;

  normalizeInput(input: string): NormalizedChannel {
    const value = input.trim().replace(/^@/, '');
    const channelKey = value
      .replace(/^(https?:\/\/)?(www\.)?kick\.com\//i, '')
      .replace(/\/+$/, '')
      .split('/')[0];
    return {
      channelKey,
      url: `https://kick.com/${channelKey}`,
      displayName: channelKey
    };
  }
}
