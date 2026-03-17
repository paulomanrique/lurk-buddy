import { describe, expect, it } from 'vitest';
import { resolveLiveNetworkMode } from '../../src/modules/live-sessions/network-policy';

describe('resolveLiveNetworkMode', () => {
  it('keeps all sessions unlimited when the feature is disabled', () => {
    expect(
      resolveLiveNetworkMode({
        enabled: false,
        sessionId: 's1',
        activeSessionId: 's2',
        liveBounds: { x: 0, y: 0, width: 100, height: 100 }
      })
    ).toBe('unlimited');
  });

  it('limits all sessions when the feature is enabled and no live area is visible', () => {
    expect(
      resolveLiveNetworkMode({
        enabled: true,
        sessionId: 's1',
        activeSessionId: null,
        liveBounds: null
      })
    ).toBe('limited');
  });

  it('keeps the active session unlimited and limits background sessions when a live area is visible', () => {
    expect(
      resolveLiveNetworkMode({
        enabled: true,
        sessionId: 's1',
        activeSessionId: 's1',
        liveBounds: { x: 0, y: 0, width: 100, height: 100 }
      })
    ).toBe('unlimited');

    expect(
      resolveLiveNetworkMode({
        enabled: true,
        sessionId: 's2',
        activeSessionId: 's1',
        liveBounds: { x: 0, y: 0, width: 100, height: 100 }
      })
    ).toBe('limited');
  });
});
