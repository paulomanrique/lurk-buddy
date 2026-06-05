import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';
import { getTwitterLiveBroadcast } from '../../modules/platform-api/twitter-api.js';

export class TwitterAdapter extends BasePlatformAdapter {
  readonly platform = 'twitter' as const;

  normalizeInput(input: string): NormalizedChannel {
    const value = input.trim();
    const cleaned = value
      .replace(/^https?:\/\/(www\.|mobile\.)?(x|twitter)\.com\//i, '')
      .replace(/^@/, '')
      .replace(/\/+$/, '')
      .split('/')[0];
    return {
      channelKey: cleaned,
      url: `https://x.com/${cleaned}`,
      displayName: cleaned
    };
  }

  override async getChannelStatus(channel: Channel): Promise<ChannelStatus> {
    const broadcast = await getTwitterLiveBroadcast(channel.channelKey);
    if (!broadcast) {
      return {
        isLive: false,
        watchUrl: this.buildWatchUrl(channel),
        title: `${channel.displayName} is offline`
      };
    }

    return {
      isLive: true,
      watchUrl: `https://x.com/i/broadcasts/${broadcast.broadcastId}`,
      title: broadcast.title ?? `${channel.displayName} is live`,
      raw: broadcast
    };
  }

  override buildWatchUrl(channel: Channel, status?: ChannelStatus): string {
    return status?.watchUrl ?? channel.url;
  }
}
