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
        const pageText = (document.body?.innerText ?? '').replace(/\\s+/g, ' ').trim().slice(0, 4000);
        const knownErrors = [
          /there was a network error/i,
          /error\\s*#\\d+/i,
          /reload player/i,
          /playback error/i
        ];
        const errorMessage = knownErrors.some((pattern) => pattern.test(pageText))
          ? pageText
          : null;
        return {
          playerDetected: Boolean(media),
          pageClaimsFocused: document.hasFocus(),
          pageClaimsVisible: document.visibilityState === 'visible' && document.hidden === false,
          siteMuted: media ? media.muted : null,
          containerMuted: false,
          ended: media ? (media.ended || media.readyState === 0) : false,
          errorMessage
        };
      })();
    `) as Promise<PlaybackState>;
  }

  detectSessionEnded(state: PlaybackState): boolean {
    return state.ended === true;
  }

  protected matchesLiveHtml(html: string): boolean {
    return /"isLiveBroadcast":true|"isLiveNow":true|"isLive":true/i.test(html);
  }

  protected extractJsonLdBlocks(html: string): unknown[] {
    const matches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
    const blocks: unknown[] = [];
    for (const match of matches) {
      const json = match
        .replace(/^<script type="application\/ld\+json">/i, '')
        .replace(/<\/script>$/i, '');
      try {
        blocks.push(JSON.parse(json));
      } catch {
        continue;
      }
    }
    return blocks;
  }
}
