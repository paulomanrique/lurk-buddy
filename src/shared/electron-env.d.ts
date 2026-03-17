import type { LurkBuddyApi } from './ipc.js';

declare global {
  interface Window {
    lurkBuddy: LurkBuddyApi;
  }
}

export {};
