import type { BrowserWindow, WebContentsView } from 'electron';
import * as electron from 'electron';
import type { Channel, LiveSession, LiveViewBounds } from '../../shared/types.js';
import { PLATFORM_HOSTS, PLATFORM_PARTITIONS } from '../../shared/constants.js';
import { makeId, nowIso } from '../../shared/utils.js';
import { adapters } from '../../platforms/index.js';
import { LiveSessionRepository } from './live-session-repository.js';
import { LogService } from '../logging/log-service.js';

const { session } = electron;

export interface LiveView {
  sessionId: string;
  view: WebContentsView;
}

export class LiveSessionService {
  private readonly views = new Map<string, LiveView>();
  private readonly mutedState = new Map<string, boolean>();
  private hostWindow: BrowserWindow | null = null;
  private activeSessionId: string | null = null;
  private liveBounds: LiveViewBounds | null = null;

  constructor(
    private readonly repository: LiveSessionRepository,
    private readonly logs: LogService,
    private readonly preloadPath: string
  ) {}

  attachWindow(window: BrowserWindow): void {
    this.hostWindow = window;
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

  activeList(): LiveSession[] {
    return this.repository.getActive().map((session) => ({
      ...session,
      containerMuted: this.getMutedState(session.id)
    }));
  }

  async ensureSession(channel: Channel, streamUrl: string): Promise<LiveSession> {
    const existing = this.repository.getByChannelId(channel.id);
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
    this.views.set(liveSession.id, { sessionId: liveSession.id, view });
    this.mutedState.set(liveSession.id, true);
    this.configureView(view, channel);
    await viewSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    await view.webContents.loadURL(streamUrl);
    view.webContents.setAudioMuted(true);
    adapters[channel.platform].attachSessionObservers(view.webContents);
    this.updateSession({ ...liveSession, status: 'live', lastHeartbeatAt: nowIso() });
    this.activeSessionId = liveSession.id;
    this.syncViewVisibility();
    this.logs.write('info', 'live-sessions', 'Opened live tab', {
      channelId: channel.id,
      sessionId: liveSession.id
    });
    return this.repository.getByChannelId(channel.id) ?? liveSession;
  }

  activate(sessionId: string): void {
    this.activeSessionId = sessionId;
    this.syncViewVisibility();
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
    this.syncViewVisibility();
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
    }
    this.updateSession({
      ...sessionRow,
      status: 'closed',
      closedAt: nowIso(),
      lastHeartbeatAt: nowIso()
    });
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = this.active()[0]?.id ?? null;
      this.syncViewVisibility();
    }
    this.logs.write('info', 'live-sessions', 'Closed live tab', { sessionId });
  }

  async closeByChannelId(channelId: string, gracePeriodSeconds: number): Promise<void> {
    const sessionRow = this.repository.getByChannelId(channelId);
    if (!sessionRow) {
      return;
    }
    const elapsed = Date.now() - new Date(sessionRow.openedAt).getTime();
    if (elapsed > gracePeriodSeconds * 1000) {
      await this.close(sessionRow.id);
      return;
    }
    this.updateSession({ ...sessionRow, status: 'ending', lastHeartbeatAt: nowIso() });
  }

  async checkPlaybackAndCloseEnded(gracePeriodSeconds: number): Promise<void> {
    const currentSessions = this.active();
    for (const sessionRow of currentSessions) {
      const liveView = this.views.get(sessionRow.id);
      if (!liveView) {
        continue;
      }
      const adapter = adapters[sessionRow.platform];
      const playback = await adapter.extractPlaybackState(liveView.view.webContents);
      playback.containerMuted = liveView.view.webContents.isAudioMuted();
      if (adapter.detectSessionEnded(playback)) {
        this.updateSession({ ...sessionRow, status: 'ending', lastHeartbeatAt: nowIso() });
        continue;
      }
      const muted = this.getMutedState(sessionRow.id);
      liveView.view.webContents.setAudioMuted(muted);
      this.updateSession({ ...sessionRow, status: 'live', lastHeartbeatAt: nowIso() });
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
    view.setBackgroundColor('#000000');
    this.hostWindow?.contentView.addChildView(view);
    this.syncViewVisibility();
  }

  private syncViewVisibility(): void {
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
  }

  private getMutedState(sessionId: string): boolean {
    return this.mutedState.get(sessionId) ?? true;
  }

  private updateSession(session: LiveSession): LiveSession {
    return this.repository.update(session);
  }
}
