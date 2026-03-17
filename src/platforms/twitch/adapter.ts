import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';
import { getTwitchLiveStream } from '../../modules/platform-api/twitch-api.js';

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

  override async getChannelStatus(channel: Channel): Promise<ChannelStatus> {
    const stream = await getTwitchLiveStream(channel.channelKey);
    if (stream) {
      return {
        isLive: true,
        watchUrl: this.buildWatchUrl(channel),
        title: stream.title,
        viewerCount: stream.viewer_count,
        raw: stream
      };
    }

    return {
      isLive: false,
      watchUrl: this.buildWatchUrl(channel),
      title: `${channel.displayName} is offline`
    };
  }
}
