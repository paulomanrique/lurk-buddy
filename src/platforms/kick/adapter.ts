import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';
import { extractKickLiveStatus, getKickChannelStatus } from '../../modules/platform-api/kick-api.js';

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
    const payload = await getKickChannelStatus(channel.channelKey);
    const isLive = extractKickLiveStatus(payload);
    return {
      isLive,
      watchUrl: channel.url,
      title: isLive ? `${channel.displayName} is live` : `${channel.displayName} is offline`,
      raw: payload
    };
  }
}
