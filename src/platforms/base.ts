import type { WebContents } from 'electron';
import type { Channel, ChannelStatus, PlaybackState, Platform } from '../shared/types.js';

export interface NormalizedChannel {
  channelKey: string;
  url: string;
  displayName: string;
}

export interface PlatformAdapter {
  readonly platform: Platform;
  normalizeInput(input: string): NormalizedChannel;
  getChannelStatus(channel: Channel): Promise<ChannelStatus>;
  buildWatchUrl(channel: Channel, status?: ChannelStatus): string;
  attachSessionObservers(webContents: WebContents): void;
  extractPlaybackState(webContents: WebContents): Promise<PlaybackState>;
  detectSessionEnded(state: PlaybackState): boolean;
}

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platform: Platform;

  abstract normalizeInput(input: string): NormalizedChannel;

  async getChannelStatus(channel: Channel): Promise<ChannelStatus> {
    const response = await fetch(channel.url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
      }
    });
    const html = await response.text();
    const isLive = this.matchesLiveHtml(html);
    return {
      isLive,
      watchUrl: this.buildWatchUrl(channel),
      title: isLive ? `${channel.displayName} is live` : `${channel.displayName} is offline`,
      raw: { status: response.status }
    };
  }

  buildWatchUrl(channel: Channel): string {
    return channel.url;
  }

  attachSessionObservers(_webContents: WebContents): void {}

  async extractPlaybackState(webContents: WebContents): Promise<PlaybackState> {
    return webContents.executeJavaScript(`
      (() => {
        const media = document.querySelector('video, audio');
        return {
          playerDetected: Boolean(media),
          pageClaimsFocused: document.hasFocus(),
          pageClaimsVisible: document.visibilityState === 'visible' && document.hidden === false,
          siteMuted: media ? media.muted : null,
          containerMuted: false,
          ended: media ? (media.ended || media.readyState === 0) : false
        };
      })();
    `) as Promise<PlaybackState>;
  }

  detectSessionEnded(state: PlaybackState): boolean {
    return state.ended;
  }

  protected matchesLiveHtml(html: string): boolean {
    return /isLiveBroadcast|LIVE|live now|og:video/i.test(html);
  }
}
