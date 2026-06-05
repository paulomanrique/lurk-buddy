import type { WebContents } from 'electron';
import { BasePlatformAdapter, type NormalizedChannel } from '../base.js';
import type { Channel, ChannelStatus } from '../../shared/types.js';
import { getInstagramLiveInfo } from '../../modules/platform-api/instagram-api.js';

// Instagram live renders a "tap to play" overlay that gates playback until the
// viewer clicks. Since the tab is loaded without a real user gesture, we dismiss
// it in-page: poll for the <video>, click the player area to clear the overlay,
// and call play(). The loop stops once the video is actually playing and bails
// after a bounded number of attempts. Re-runs on each document load (reloads).
const TAP_TO_PLAY_SCRIPT = `
(() => {
  if (window.__lbTapToPlay) return;
  window.__lbTapToPlay = true;
  let tries = 0;
  const fire = (el) => {
    if (!el) return;
    const o = { bubbles: true, cancelable: true, view: window, button: 0, clientX: 1, clientY: 1 };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', o));
      el.dispatchEvent(new MouseEvent('mousedown', o));
      el.dispatchEvent(new PointerEvent('pointerup', o));
      el.dispatchEvent(new MouseEvent('mouseup', o));
      el.dispatchEvent(new MouseEvent('click', o));
    } catch (e) {}
  };
  const playing = (v) => v && !v.paused && !v.ended && v.readyState >= 2;
  const tick = () => {
    tries++;
    const video = document.querySelector('video');
    if (playing(video)) return;
    if (video) {
      try { video.play(); } catch (e) {}
      fire(video.parentElement || video);
    }
    if (tries < 40 && !playing(video)) setTimeout(tick, 500);
  };
  tick();
})();
`;

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
    const dismissOverlay = () => {
      void webContents.executeJavaScript(TAP_TO_PLAY_SCRIPT).catch(() => {});
    };
    // Run for the page that just loaded, and again after any reload/navigation.
    dismissOverlay();
    webContents.on('dom-ready', dismissOverlay);
  }
}
