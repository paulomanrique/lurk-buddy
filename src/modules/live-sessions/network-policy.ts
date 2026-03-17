import type { LiveViewBounds } from '../../shared/types.js';

export type LiveNetworkMode = 'limited' | 'unlimited';

interface ResolveLiveNetworkModeInput {
  enabled: boolean;
  sessionId: string;
  activeSessionId: string | null;
  liveBounds: LiveViewBounds | null;
}

export function resolveLiveNetworkMode(input: ResolveLiveNetworkModeInput): LiveNetworkMode {
  if (!input.enabled) {
    return 'unlimited';
  }
  if (!input.liveBounds || !input.activeSessionId) {
    return 'limited';
  }
  return input.sessionId === input.activeSessionId ? 'unlimited' : 'limited';
}
