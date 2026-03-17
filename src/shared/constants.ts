import type { AppSettings, Platform } from './types.js';

export const APP_NAME = 'Lurk Buddy';
export const BRAND_PRIMARY = '#ff6268';
export const BRAND_PRIMARY_HOVER = '#e5575d';
export const BRAND_PRIMARY_ACTIVE = '#cc4d53';
export const BRAND_BLACK = '#000000';
export const BRAND_SURFACE_DARK = '#090909';
export const BRAND_SURFACE_ELEVATED = '#131313';
export const BRAND_TEXT_PRIMARY = '#f7efef';
export const BRAND_TEXT_MUTED = '#d3b7b8';
export const BRAND_BORDER_SUBTLE = 'rgba(255, 98, 104, 0.24)';

export const DEFAULT_SETTINGS: AppSettings = {
  maxConcurrentLives: 12,
  startOnLogin: false,
  minimizeToTray: false,
  autoOpenLives: true,
  closeGracePeriodSeconds: 90,
  enableFocusSpoof: true,
  enablePerTabMute: true,
  enableLowBandwidthBackgroundLives: false
};

export const PLATFORM_PARTITIONS: Record<Platform, string> = {
  twitch: 'persist:twitch',
  youtube: 'persist:youtube',
  kick: 'persist:kick'
};

export const PLATFORM_HOSTS: Record<Platform, string[]> = {
  twitch: ['www.twitch.tv', 'twitch.tv', 'player.twitch.tv'],
  youtube: ['www.youtube.com', 'youtube.com', 'm.youtube.com'],
  kick: ['kick.com', 'www.kick.com']
};

export const POLL_TICK_MS = 60_000;
