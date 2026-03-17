import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';

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
    const response = await fetch(channel.url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
      }
    });
    const html = await response.text();
    const blocks = this.extractJsonLdBlocks(html);
    const liveGraph = blocks.find((block) => this.isLiveGraph(block));
    const isLive = Boolean(liveGraph);

    return {
      isLive,
      watchUrl: this.buildWatchUrl(channel),
      title: isLive ? `${channel.displayName} is live` : `${channel.displayName} is offline`,
      raw: { status: response.status }
    };
  }

  private isLiveGraph(block: unknown): boolean {
    if (!block || typeof block !== 'object') {
      return false;
    }
    const candidate = block as {
      '@graph'?: Array<{
        '@type'?: string;
        publication?: { isLiveBroadcast?: boolean; endDate?: string };
      }>;
    };
    const items = candidate['@graph'] ?? [];
    return items.some((item) => {
      if (item['@type'] !== 'VideoObject') {
        return false;
      }
      const live = item.publication?.isLiveBroadcast === true;
      const endDate = item.publication?.endDate ? Date.parse(item.publication.endDate) : null;
      return live && (endDate === null || endDate >= Date.now() - 60_000);
    });
  }
}
