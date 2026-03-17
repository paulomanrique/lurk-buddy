import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';
import { getYouTubeLiveVideo } from '../../modules/platform-api/youtube-api.js';

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
    const video = await getYouTubeLiveVideo(channel.channelKey);
    const isLive = Boolean(video?.id?.videoId);

    return {
      isLive,
      watchUrl: isLive ? `https://www.youtube.com/watch?v=${video!.id!.videoId}` : channel.url,
      title: video?.snippet?.title ?? (isLive ? `${channel.displayName} is live` : `${channel.displayName} is offline`),
      raw: video ?? null
    };
  }

  override buildWatchUrl(channel: Channel, status?: ChannelStatus): string {
    return status?.watchUrl ?? channel.url;
  }
}
