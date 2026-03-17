import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';
import { getYouTubeLiveVideos } from '../../modules/platform-api/youtube-api.js';

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
    const videos = await getYouTubeLiveVideos(channel.channelKey);
    const isLive = videos.length > 0;
    const allWatchUrls = videos.map((v) => `https://www.youtube.com/watch?v=${v.id!.videoId}`);

    return {
      isLive,
      watchUrl: allWatchUrls[0] ?? channel.url,
      allWatchUrls,
      title: videos[0]?.snippet?.title ?? (isLive ? `${channel.displayName} is live` : `${channel.displayName} is offline`),
      raw: videos
    };
  }

  override buildWatchUrl(channel: Channel, status?: ChannelStatus): string {
    return status?.watchUrl ?? channel.url;
  }
}
