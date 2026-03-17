import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';

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

  override async getChannelStatus(channel: Channel): Promise<ChannelStatus> {
    const liveUrl = `${channel.url.replace(/\/+$/, '')}/live`;
    const response = await fetch(liveUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+667'
      }
    });
    const html = await response.text();
    const isWatchLike = /ytInitialPlayerResponse/i.test(html);
    const isLive = isWatchLike && this.matchesLiveHtml(html);

    return {
      isLive,
      watchUrl: isLive ? liveUrl : channel.url,
      title: isLive ? `${channel.displayName} is live` : `${channel.displayName} is offline`,
      raw: { status: response.status }
    };
  }

  override buildWatchUrl(channel: Channel, status?: ChannelStatus): string {
    return status?.watchUrl ?? `${channel.url.replace(/\/+$/, '')}/live`;
  }

  protected override matchesLiveHtml(html: string): boolean {
    return /ytInitialPlayerResponse|isLiveHead|liveChatRenderer|hlsManifestUrl|dashManifestUrl/i.test(html);
  }
}
