import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';
import { getTikTokLiveInfo } from '../../modules/platform-api/tiktok-api.js';

export class TikTokAdapter extends BasePlatformAdapter {
  readonly platform = 'tiktok' as const;

  normalizeInput(input: string): NormalizedChannel {
    const value = input.trim();
    const cleaned = value
      .replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '')
      .replace(/^@/, '')
      .replace(/\/live\/?$/i, '')
      .replace(/\/+$/, '')
      .split('/')[0];
    return {
      channelKey: cleaned,
      url: `https://www.tiktok.com/@${cleaned}/live`,
      displayName: cleaned
    };
  }

  override async getChannelStatus(channel: Channel): Promise<ChannelStatus> {
    const info = await getTikTokLiveInfo(channel.channelKey);
    if (!info) {
      return {
        isLive: false,
        watchUrl: this.buildWatchUrl(channel),
        title: `${channel.displayName} is offline`
      };
    }

    return {
      isLive: true,
      watchUrl: this.buildWatchUrl(channel),
      title: info.nickname ? `${info.nickname} is live` : `${channel.displayName} is live`,
      raw: info
    };
  }
}
