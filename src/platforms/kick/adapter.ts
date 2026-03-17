import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';

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

  override async getChannelStatus(channel: Channel): Promise<ChannelStatus> {
    const response = await fetch(channel.url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        accept: 'text/html,application/xhtml+xml'
      }
    });

    if (response.status === 403) {
      return {
        isLive: false,
        watchUrl: channel.url,
        title: `${channel.displayName} status unavailable`,
        raw: { status: response.status, blocked: true }
      };
    }

    const html = await response.text();
    const isLive = this.matchesLiveHtml(html);
    return {
      isLive,
      watchUrl: channel.url,
      title: isLive ? `${channel.displayName} is live` : `${channel.displayName} is offline`,
      raw: { status: response.status }
    };
  }

  protected override matchesLiveHtml(html: string): boolean {
    return /watching now|stream title|playback_url|live-badge|is-live/i.test(html);
  }
}
