import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';

export class YouTubeAdapter extends BasePlatformAdapter {
  readonly platform = 'youtube' as const;

  normalizeInput(input: string): NormalizedChannel {
    const value = input.trim();
    const cleaned = value
      .replace(/^https?:\/\/(www\.)?youtube\.com\//i, '')
      .replace(/^@/, '')
      .replace(/\/+$/, '');
    const channelKey = cleaned.startsWith('@') ? cleaned : `@${cleaned.replace(/^channel\//, '')}`;
    return {
      channelKey,
      url: `https://www.youtube.com/${channelKey}`,
      displayName: channelKey.replace(/^@/, '')
    };
  }
}
