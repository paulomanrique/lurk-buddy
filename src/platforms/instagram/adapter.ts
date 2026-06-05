import type { WebContents } from 'electron';
import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';
import { getInstagramLiveInfo } from '../../modules/platform-api/instagram-api.js';

// Reads the current player state from the page: viewport size (for click
// coordinates) and whether a <video> is present and already playing.
const PLAYER_STATE_SCRIPT = `(() => {
  const v = document.querySelector('video');
  let x = Math.floor(window.innerWidth / 2);
  let y = Math.floor(window.innerHeight / 2);
  if (v) {
    const r = v.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      x = Math.floor(r.left + r.width / 2);
      y = Math.floor(r.top + r.height / 2);
    }
  }
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    x: x,
    y: y,
    hasVideo: !!v,
    playing: !!(v && !v.paused && !v.ended && v.readyState >= 2)
  };
})()`;

interface PlayerState {
  w: number;
  h: number;
  x: number;
  y: number;
  hasVideo: boolean;
  playing: boolean;
}

const TAP_MAX_ATTEMPTS = 30;
const TAP_INTERVAL_MS = 700;

export class InstagramAdapter extends BasePlatformAdapter {
  readonly platform = 'instagram' as const;

  // Tracks webContents that already have a dismiss loop running, so reloads
  // don't stack concurrent loops.
  private readonly dismissing = new WeakSet<WebContents>();

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
      // The `broadcast_id` query param is required — without it Instagram
      // redirects /<user>/live/ back to the profile home.
      watchUrl: `https://www.instagram.com/${channel.channelKey}/live/?broadcast_id=${info.broadcastId}`,
      title: info.nickname ? `${info.nickname} is live` : `${channel.displayName} is live`,
      raw: info
    };
  }

  override buildWatchUrl(channel: Channel, status?: ChannelStatus): string {
    return status?.watchUrl ?? channel.url;
  }

  override attachSessionObservers(webContents: WebContents): void {
    // Run for the page that just loaded, and again after any reload/navigation.
    void this.dismissTapToPlay(webContents);
    webContents.on('dom-ready', () => void this.dismissTapToPlay(webContents));
  }

  // Instagram live gates playback behind a "tap to play" overlay that only
  // clears on a trusted user gesture (a synthetic JS click is ignored). We send
  // a real mouse click at the centre of the view via sendInputEvent, retrying
  // until the <video> reports it is playing or we exhaust the attempt budget.
  private async dismissTapToPlay(webContents: WebContents): Promise<void> {
    if (this.dismissing.has(webContents)) return;
    this.dismissing.add(webContents);
    try {
      for (let attempt = 0; attempt < TAP_MAX_ATTEMPTS; attempt += 1) {
        if (webContents.isDestroyed()) return;

        let state: PlayerState | null = null;
        try {
          state = (await webContents.executeJavaScript(PLAYER_STATE_SCRIPT)) as PlayerState;
        } catch {
          // Page is mid-navigation; try again next tick.
        }

        if (state?.playing) return;

        // Only click once the view has real dimensions (an active, sized tab).
        if (state && state.w > 1 && state.h > 1) {
          const { x, y } = state;
          webContents.sendInputEvent({ type: 'mouseMove', x, y });
          webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
          webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        }

        await new Promise((resolve) => setTimeout(resolve, TAP_INTERVAL_MS));
      }
    } finally {
      this.dismissing.delete(webContents);
    }
  }
}
