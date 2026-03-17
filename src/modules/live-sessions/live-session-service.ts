import type { BrowserWindow, WebContentsView } from 'electron';
import * as electron from 'electron';
import type { Channel, LiveSession, LiveViewBounds } from '../../shared/types.js';
import { PLATFORM_HOSTS, PLATFORM_PARTITIONS } from '../../shared/constants.js';
import { makeId, nowIso } from '../../shared/utils.js';
import { adapters } from '../../platforms/index.js';
import { LiveSessionRepository } from './live-session-repository.js';
import { LogService } from '../logging/log-service.js';
import { SettingsService } from '../settings/settings-service.js';
import { resolveLiveNetworkMode, type LiveNetworkMode } from './network-policy.js';

const { session } = electron;
const DEBUGGER_PROTOCOL_VERSION = '1.3';
const LIMITED_NETWORK_PROFILE = {
  offline: false,
  latency: 200,
  downloadThroughput: 48 * 1024,
  uploadThroughput: 24 * 1024,
  connectionType: 'cellular3g'
} as const;
const UNLIMITED_NETWORK_PROFILE = {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
  connectionType: 'wifi'
} as const;
const PLAYBACK_ERROR_RELOAD_COOLDOWN_MS = 15_000;

export interface LiveView {
  sessionId: string;
  view: WebContentsView;
  networkMode: LiveNetworkMode;
}

export class LiveSessionService {
  private readonly views = new Map<string, LiveView>();
  private readonly mutedState = new Map<string, boolean>();
  private readonly lastReloadAt = new Map<string, number>();
  private hostWindow: BrowserWindow | null = null;
  private activeSessionId: string | null = null;
  private liveBounds: LiveViewBounds | null = null;

  constructor(
    private readonly repository: LiveSessionRepository,
    private readonly logs: LogService,
    private readonly preloadPath: string,
    private readonly settings: SettingsService
  ) {}

  attachWindow(window: BrowserWindow): void {
    this.hostWindow = window;
    this.closeStaleSessionsFromPreviousRuns();
  }

  list(): LiveSession[] {
    return this.repository.list().map((session) => ({
      ...session,
      containerMuted: this.getMutedState(session.id)
    }));
  }

  active(): LiveSession[] {
    return this.repository.getActive();
  }

  hasActiveSession(channelId: string): boolean {
    return this.repository.getAllActiveByChannelId(channelId).length > 0;
  }

  activeList(): LiveSession[] {
    return this.repository.getActive().map((session) => ({
      ...session,
      containerMuted: this.getMutedState(session.id)
    }));
  }

  async ensureSession(channel: Channel, streamUrl: string): Promise<LiveSession> {
    const existing = this.repository.getByChannelAndUrl(channel.id, streamUrl);
    if (existing) {
      return existing;
    }
    const partition = PLATFORM_PARTITIONS[channel.platform];
    const viewSession = session.fromPartition(partition);
    const { WebContentsView } = electron;
    const view = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });
    const tabId = makeId();
    const liveSession: LiveSession = {
      id: makeId(),
      channelId: channel.id,
      platform: channel.platform,
      status: 'opening',
      openedAt: nowIso(),
      closedAt: null,
      lastHeartbeatAt: null,
      tabId,
      streamUrl,
      lastDetectedTitle: null,
      lastError: null
    };
    this.repository.save(liveSession);
    this.views.set(liveSession.id, { sessionId: liveSession.id, view, networkMode: 'unlimited' });
    this.mutedState.set(liveSession.id, true);
    this.configureView(view, channel);
    await viewSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    await view.webContents.loadURL(streamUrl);
    view.webContents.setAudioMuted(true);
    await this.ensureDebuggerAttached(liveSession.id);
    adapters[channel.platform].attachSessionObservers(view.webContents);
    this.updateSession({ ...liveSession, status: 'live', lastHeartbeatAt: nowIso() });
    if (!this.activeSessionId || !this.views.has(this.activeSessionId)) {
      this.activeSessionId = liveSession.id;
    }
    await this.syncViewVisibility();
    this.logs.write('info', 'live-sessions', 'Opened live tab', {
      channelId: channel.id,
      sessionId: liveSession.id
    });
    return this.repository.getByChannelId(channel.id) ?? liveSession;
  }

  async activate(sessionId: string): Promise<void> {
    this.activeSessionId = sessionId;
    await this.syncViewVisibility();
  }

  setMuted(sessionId: string, muted: boolean): void {
    this.mutedState.set(sessionId, muted);
    const liveView = this.views.get(sessionId);
    if (liveView) {
      liveView.view.webContents.setAudioMuted(muted);
    }
  }

  updateLayout(sessionId: string | null, bounds: LiveViewBounds | null): void {
    this.activeSessionId = sessionId;
    this.liveBounds = bounds;
    void this.syncViewVisibility();
  }

  refreshNetworkPolicies(): void {
    void this.applyNetworkPolicies();
  }

  async close(sessionId: string): Promise<void> {
    const sessionRow = this.repository.list().find((entry) => entry.id === sessionId);
    if (!sessionRow) {
      return;
    }
    const liveView = this.views.get(sessionId);
    if (liveView) {
      this.hostWindow?.contentView.removeChildView(liveView.view);
      liveView.view.webContents.close();
      this.views.delete(sessionId);
      this.mutedState.delete(sessionId);
      this.lastReloadAt.delete(sessionId);
    }
    this.updateSession({
      ...sessionRow,
      status: 'closed',
      closedAt: nowIso(),
      lastHeartbeatAt: nowIso()
    });
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = this.active()[0]?.id ?? null;
      await this.syncViewVisibility();
    } else {
      await this.applyNetworkPolicies();
    }
    this.logs.write('info', 'live-sessions', 'Closed live tab', { sessionId });
  }

  async closeByChannelId(channelId: string, gracePeriodSeconds: number): Promise<void> {
    const sessions = this.repository.getAllActiveByChannelId(channelId);
    for (const sessionRow of sessions) {
      const elapsed = Date.now() - new Date(sessionRow.openedAt).getTime();
      if (elapsed > gracePeriodSeconds * 1000) {
        await this.close(sessionRow.id);
      } else {
        this.updateSession({ ...sessionRow, status: 'ending', lastHeartbeatAt: nowIso() });
      }
    }
  }

  async closeStaleSessionsForChannel(channelId: string, activeUrls: string[], gracePeriodSeconds: number): Promise<void> {
    const sessions = this.repository.getAllActiveByChannelId(channelId);
    for (const sessionRow of sessions) {
      if (!activeUrls.includes(sessionRow.streamUrl)) {
        const elapsed = Date.now() - new Date(sessionRow.openedAt).getTime();
        if (elapsed > gracePeriodSeconds * 1000) {
          await this.close(sessionRow.id);
        } else {
          this.updateSession({ ...sessionRow, status: 'ending', lastHeartbeatAt: nowIso() });
        }
      }
    }
  }

  async checkPlaybackAndCloseEnded(gracePeriodSeconds: number): Promise<void> {
    const currentSessions = this.active();
    for (const sessionRow of currentSessions) {
      const liveView = this.views.get(sessionRow.id);
      if (!liveView) {
        continue;
      }
      const currentUrl = liveView.view.webContents.getURL();
      if (this.didSessionUrlChange(sessionRow.streamUrl, currentUrl)) {
        this.logs.write('warn', 'live-sessions', 'Closing tab after URL change', {
          sessionId: sessionRow.id,
          previousUrl: sessionRow.streamUrl,
          currentUrl
        });
        await this.close(sessionRow.id);
        continue;
      }
      const adapter = adapters[sessionRow.platform];
      const playback = await adapter.extractPlaybackState(liveView.view.webContents);
      playback.containerMuted = liveView.view.webContents.isAudioMuted();
      if (playback.errorMessage) {
        if (sessionRow.status !== 'error' || sessionRow.lastError !== playback.errorMessage) {
          this.logs.write('warn', 'live-sessions', 'Detected recoverable playback error', {
            sessionId: sessionRow.id,
            error: playback.errorMessage
          });
        }
        this.updateSession({
          ...sessionRow,
          status: 'error',
          lastError: playback.errorMessage,
          lastHeartbeatAt: nowIso()
        });
        await this.reloadSessionAfterPlaybackError(sessionRow.id, playback.errorMessage);
        continue;
      }
      if (adapter.detectSessionEnded(playback)) {
        this.updateSession({ ...sessionRow, status: 'ending', lastHeartbeatAt: nowIso() });
        continue;
      }
      const muted = this.getMutedState(sessionRow.id);
      liveView.view.webContents.setAudioMuted(muted);
      this.updateSession({
        ...sessionRow,
        status: 'live',
        lastError: null,
        lastHeartbeatAt: nowIso()
      });
    }
  }

  private configureView(view: WebContentsView, channel: Channel): void {
    view.webContents.setWindowOpenHandler(({ url }) => {
      const allowedHosts = PLATFORM_HOSTS[channel.platform];
      const targetHost = new URL(url).host;
      if (allowedHosts.includes(targetHost)) {
        return { action: 'allow' };
      }
      return { action: 'deny' };
    });
    view.webContents.debugger.on('detach', (_event, reason) => {
      this.logs.write('warn', 'live-sessions', 'Live debugger detached', {
        reason,
        url: view.webContents.getURL(),
        channelId: channel.id
      });
    });
    view.setBackgroundColor('#000000');
    this.hostWindow?.contentView.addChildView(view);
    void this.syncViewVisibility();
  }

  private async syncViewVisibility(): Promise<void> {
    const window = this.hostWindow;
    if (!window) {
      return;
    }
    for (const [sessionId, liveView] of this.views) {
      const visible = sessionId === this.activeSessionId && this.liveBounds !== null;
      liveView.view.setVisible(visible);
      if (visible) {
        liveView.view.setBounds(this.liveBounds!);
      } else {
        liveView.view.setBounds({ x: -10_000, y: -10_000, width: 1, height: 1 });
      }
    }
    await this.applyNetworkPolicies();
  }

  private getMutedState(sessionId: string): boolean {
    return this.mutedState.get(sessionId) ?? true;
  }

  private closeStaleSessionsFromPreviousRuns(): void {
    for (const sessionRow of this.repository.getActive()) {
      if (this.views.has(sessionRow.id)) {
        continue;
      }
      this.updateSession({
        ...sessionRow,
        status: 'closed',
        closedAt: nowIso(),
        lastHeartbeatAt: nowIso(),
        lastError: 'Session closed during app restart cleanup'
      });
    }
  }

  private didSessionUrlChange(expectedUrl: string, currentUrl: string): boolean {
    if (!currentUrl) {
      return false;
    }
    try {
      const expected = new URL(expectedUrl);
      const current = new URL(currentUrl);
      return expected.host !== current.host || expected.pathname !== current.pathname;
    } catch {
      return currentUrl !== expectedUrl;
    }
  }

  private updateSession(session: LiveSession): LiveSession {
    return this.repository.update(session);
  }

  private async reloadSessionAfterPlaybackError(sessionId: string, errorMessage: string): Promise<void> {
    const liveView = this.views.get(sessionId);
    if (!liveView || liveView.view.webContents.isLoading()) {
      return;
    }

    const now = Date.now();
    const lastReload = this.lastReloadAt.get(sessionId) ?? 0;
    if (now - lastReload < PLAYBACK_ERROR_RELOAD_COOLDOWN_MS) {
      return;
    }

    this.lastReloadAt.set(sessionId, now);
    this.logs.write('info', 'live-sessions', 'Reloading player after recoverable playback error', {
      sessionId,
      error: errorMessage
    });

    try {
      await liveView.view.webContents.reloadIgnoringCache();
    } catch (error) {
      this.logs.write('warn', 'live-sessions', 'Failed to reload player after playback error', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async applyNetworkPolicies(): Promise<void> {
    const featureEnabled = this.settings.get().enableLowBandwidthBackgroundLives;
    for (const [sessionId, liveView] of this.views) {
      const nextMode = resolveLiveNetworkMode({
        enabled: featureEnabled,
        sessionId,
        activeSessionId: this.activeSessionId,
        liveBounds: this.liveBounds
      });
      await this.applyNetworkMode(liveView, nextMode);
    }
  }

  private async applyNetworkMode(liveView: LiveView, mode: LiveNetworkMode): Promise<void> {
    if (liveView.networkMode === mode && liveView.view.webContents.debugger.isAttached()) {
      return;
    }

    const attached = await this.ensureDebuggerAttached(liveView.sessionId);
    if (!attached) {
      return;
    }

    try {
      await liveView.view.webContents.debugger.sendCommand(
        'Network.emulateNetworkConditions',
        mode === 'limited' ? LIMITED_NETWORK_PROFILE : UNLIMITED_NETWORK_PROFILE
      );
      liveView.networkMode = mode;
    } catch (error) {
      this.logs.write('warn', 'live-sessions', 'Failed to apply live network policy', {
        sessionId: liveView.sessionId,
        mode,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async ensureDebuggerAttached(sessionId: string): Promise<boolean> {
    const liveView = this.views.get(sessionId);
    if (!liveView) {
      return false;
    }

    const { debugger: webDebugger } = liveView.view.webContents;
    if (!webDebugger.isAttached()) {
      try {
        webDebugger.attach(DEBUGGER_PROTOCOL_VERSION);
      } catch (error) {
        this.logs.write('warn', 'live-sessions', 'Failed to attach live debugger', {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        });
        return false;
      }
    }

    try {
      await webDebugger.sendCommand('Network.enable');
      return true;
    } catch (error) {
      this.logs.write('warn', 'live-sessions', 'Failed to enable network debugging for live tab', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}
