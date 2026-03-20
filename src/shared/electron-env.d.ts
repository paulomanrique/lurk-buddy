import type { LurkBuddyApi } from './ipc.js';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    lurkBuddy: LurkBuddyApi;
  }
}

export {};
