import type { Platform } from '../shared/types.js';
import type { PlatformAdapter } from './base.js';
import { TwitchAdapter } from './twitch/adapter.js';
import { YouTubeAdapter } from './youtube/adapter.js';
import { KickAdapter } from './kick/adapter.js';

export const adapters: Record<Platform, PlatformAdapter> = {
  twitch: new TwitchAdapter(),
  youtube: new YouTubeAdapter(),
  kick: new KickAdapter()
};
