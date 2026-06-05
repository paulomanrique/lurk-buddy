import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';
import { getInstagramLiveInfo } from '../../modules/platform-api/instagram-api.js';

export class InstagramAdapter extends BasePlatformAdapter {
  readonly platform = 'instagram' as const;

  normalizeInput(input: string): NormalizedChannel {
    const value = input.trim();
    const cleaned = value
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/^@/, '')
      .replace(/\/live\/?$/i, '')
      .replace(/\/+$/, '')
      .split('/')[0];
    return {
      channelKey: cleaned,
      url: `https://www.instagram.com/${cleaned}/`,
      displayName: cleaned
    };
  }

  override async getChannelStatus(channel: Channel): Promise<ChannelStatus> {
    const info = await getInstagramLiveInfo(channel.channelKey);
    if (!info) {
      return {
        isLive: false,
        watchUrl: this.buildWatchUrl(channel),
        title: `${channel.displayName} is offline`
      };
    }

    return {
      isLive: true,
      // Best-effort live URL; the live ring is also reachable from the profile.
      watchUrl: `https://www.instagram.com/${channel.channelKey}/live/`,
      title: info.nickname ? `${info.nickname} is live` : `${channel.displayName} is live`,
      raw: info
    };
  }

  override buildWatchUrl(channel: Channel, status?: ChannelStatus): string {
    return status?.watchUrl ?? channel.url;
  }
}
