import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AppSettings, Channel } from '@shared/types';
import { APP_NAME, POLL_TICK_MS } from '@shared/constants';
import { EmptyState, PlatformBadge } from './components';
import { useAppStore } from './store';
import logoCircleUrl from './assets/logo-circle.svg';

const initialForm = { value: '', displayName: '' };
const POLL_TICK_S = Math.round(POLL_TICK_MS / 1000);

function usePollCountdown() {
  const [seconds, setSeconds] = useState(POLL_TICK_S);
  const lastResetRef = useRef(Date.now());

  // reset countdown whenever this is called
  const reset = () => {
    lastResetRef.current = Date.now();
    setSeconds(POLL_TICK_S);
  };

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastResetRef.current) / 1000);
      setSeconds(Math.max(0, POLL_TICK_S - elapsed));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return { seconds, reset };
}

export function App() {
  const { channels, sessions, settings, selectedSessionId, panelOnly, loading, hydrate, setSelectedSessionId, setPanelOnly } =
    useAppStore();
  const [form, setForm] = useState(initialForm);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const liveCanvasRef = useRef<HTMLDivElement | null>(null);
  const { seconds: pollCountdown, reset: resetPollCountdown } = usePollCountdown();

  useEffect(() => {
    void hydrate();
    return window.lurkBuddy.app.onStateChanged(() => {
      resetPollCountdown();
      void hydrate();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrate]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? sessions[0] ?? null;

  useEffect(() => {
    if (panelOnly || !selectedSession || !liveCanvasRef.current) {
      void window.lurkBuddy.lives.layout(null, null);
      return;
    }
    const updateBounds = () => {
      if (!liveCanvasRef.current) return;
      const rect = liveCanvasRef.current.getBoundingClientRect();
      void window.lurkBuddy.lives.layout(selectedSession.id, {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };
    updateBounds();
    const observer = new ResizeObserver(() => updateBounds());
    observer.observe(liveCanvasRef.current);
    window.addEventListener('resize', updateBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
      void window.lurkBuddy.lives.layout(null, null);
    };
  }, [panelOnly, selectedSession]);

  async function handleCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await window.lurkBuddy.channels.create({
      value: form.value,
      displayName: form.displayName || undefined,
    });
    setForm(initialForm);
    await hydrate();
  }

  async function handleToggle(channel: Channel) {
    await window.lurkBuddy.channels.toggle(channel.id, !channel.enabled);
    await hydrate();
  }

  async function handleDelete(channelId: string) {
    await window.lurkBuddy.channels.delete(channelId);
    await hydrate();
  }

  async function handleSettingsChange(patch: Partial<AppSettings>) {
    await window.lurkBuddy.settings.update(patch);
    await hydrate();
  }

  async function handleTestChannel(id: string) {
    setTestingId(id);
    try {
      const result = await window.lurkBuddy.channels.test(id);
      window.alert(`Status: ${result.status.isLive ? 'LIVE' : 'OFFLINE'}\nURL: ${result.normalizedUrl}`);
    } finally {
      setTestingId(null);
    }
  }

  async function handleCloseSession(sessionId: string) {
    await window.lurkBuddy.lives.close(sessionId);
    if (selectedSessionId === sessionId) setPanelOnly(true);
    await hydrate();
  }

  async function handleSelectSession(sessionId: string) {
    setPanelOnly(false);
    setSelectedSessionId(sessionId);
    await window.lurkBuddy.lives.activate(sessionId);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await window.lurkBuddy.app.runNow();
      resetPollCountdown();
      await hydrate();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleExportChannels() {
    const result = await window.lurkBuddy.channels.export();
    if (!result.path) {
      return;
    }
    window.alert(`Exported ${result.count} channel${result.count === 1 ? '' : 's'} to:\n${result.path}`);
  }

  async function handleImportChannels() {
    const result = await window.lurkBuddy.channels.import();
    if (!result.path) {
      return;
    }
    await hydrate();
    window.alert(
      `Imported ${result.imported} of ${result.total} channel${result.total === 1 ? '' : 's'}.\n` +
      `Skipped ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'}.\n\n` +
      `${result.path}`
    );
  }

  async function handleToggleMute(sessionId: string, muted: boolean) {
    await window.lurkBuddy.lives.setMuted(sessionId, !muted);
    await hydrate();
  }

  const showDashboard = panelOnly || !selectedSession;

  return (
    <div className="app-shell">

      {/* ── SESSIONS PANEL ── */}
      <div className="sessions-panel">
        <div className="sessions-header">
          <div className="sessions-brand">
            <img src={logoCircleUrl} alt={APP_NAME} className="sessions-logo" />
            <span className="sessions-eyebrow">live_tabs</span>
          </div>
          <div className="sessions-status">
            <div className="sessions-active">
              <div className="live-dot" />
              {sessions.length} active
            </div>
          </div>
        </div>

        <div className="sessions-list">
          {sessions.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Polling in background. Live channels open here automatically.
            </div>
          ) : (
            sessions.map((session) => {
              const channel = channels.find((c) => c.id === session.channelId);
              const isActive = session.id === selectedSessionId && !panelOnly;
              return (
                <div
                  key={session.id}
                  className={`session-item ${isActive ? 'active' : ''}`}
                  onClick={() => void handleSelectSession(session.id)}
                >
                  <div className="session-item-top">
                    <span className="session-name">{channel?.displayName ?? 'Unknown'}</span>
                    <div className="session-item-actions">
                      <button
                        className={`session-mute ${session.containerMuted ? 'muted' : ''}`}
                        title={session.containerMuted ? 'Unmute' : 'Mute'}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleMute(session.id, session.containerMuted);
                        }}
                      >
                        {session.containerMuted ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z"/>
                            <line x1="17" y1="9" x2="23" y2="15"/><line x1="23" y1="9" x2="17" y2="15"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z"/>
                            <path d="M15.536 8.464a5 5 0 010 7.072"/>
                          </svg>
                        )}
                      </button>
                      <button
                        className="session-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCloseSession(session.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="session-meta">
                    <PlatformBadge platform={session.platform} size="small" />
                    <span className="session-duration">{session.status}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="sessions-footer">
          <button className="panel-only-btn" onClick={() => setPanelOnly(!panelOnly)}>
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            {panelOnly ? 'show_live' : 'panel_only'}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">

        {/* Title bar */}
        <div className="title-bar">
          <div className="breadcrumb">
            <span className="breadcrumb-root">lurk-buddy</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">
              {showDashboard ? 'dashboard' : selectedSession ? 'live' : 'dashboard'}
            </span>
            <span className="breadcrumb-cursor">_</span>
          </div>
          <div className="title-bar-meta">
            {!showDashboard && selectedSession && (
              <button className="ghost-btn" onClick={() => setPanelOnly(true)}>
                back_to_panel
              </button>
            )}
            <span className="title-bar-stat">
              channels <span>{channels.length}</span>
            </span>
            <span className="title-bar-stat">
              active <span className="brand">{sessions.length}</span>
            </span>
            <div className="title-bar-poll">
              <div className="live-dot sm" />
              Next check in <span>{pollCountdown}s</span>
            </div>
            <button
              className="ghost-btn"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
            >
              {refreshing ? '[...]' : '[refresh]'}
            </button>
          </div>
        </div>

        {/* Body */}
        {showDashboard ? (
          <div className="main-body">

            {/* ── ADD CHANNEL ── */}
            <div className="section-block">
              <div className="sec-header">
                <span className="sec-label">channel_registry.add</span>
                <div className="sec-header-actions">
                  <button className="ghost-btn" onClick={() => void handleImportChannels()}>
                    import
                  </button>
                  <button className="ghost-btn" onClick={() => void handleExportChannels()}>
                    export
                  </button>
                </div>
              </div>
              <div className="sec-body">
                <form className="channel-form" onSubmit={handleCreateChannel}>
                  <div className="form-field">
                    <span className="form-label">url</span>
                    <div className="input-shell">
                      <span className="input-prefix">$</span>
                      <input
                        className="field-input"
                        placeholder="https://twitch.tv/..."
                        value={form.value}
                        onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-field">
                    <span className="form-label">display_name</span>
                    <input
                      className="field-input"
                      placeholder="optional"
                      value={form.displayName}
                      onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    />
                  </div>
                  <button className="primary-btn" type="submit" style={{ alignSelf: 'flex-end' }}>
                    + add
                  </button>
                </form>
              </div>
            </div>

            {/* ── CHANNEL TABLE ── */}
            <div className="section-block channels-section">
              <div className="sec-header">
                <span className="sec-label">queue_control.channels</span>
                <span className="sec-meta">{channels.length} total</span>
              </div>
              <div className="ch-table-head">
                <span></span>
                <span>handle</span>
                <span>url</span>
                <span style={{ textAlign: 'right' }}>actions</span>
              </div>
              {channels.length === 0 ? (
                <div className="sec-body channels-body channels-body-empty">
                  <EmptyState
                    title="No channels yet"
                    description="Paste a Twitch, YouTube or Kick URL above and Lurk Buddy will detect the platform automatically."
                  />
                </div>
              ) : (
                <div className="channels-body">
                  {channels.map((channel) => (
                    <div key={channel.id} className={`ch-row ${channel.enabled ? '' : 'disabled'}`}>
                      <PlatformBadge platform={channel.platform} size="icon" />
                      <div className="ch-name">{channel.displayName}</div>
                      <div className="ch-url-cell">
                        <span className="ch-url">{channel.url}</span>
                        <button
                          className="ch-copy"
                          title="Copy URL"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard.writeText(channel.url);
                          }}
                        >
                          <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/>
                          </svg>
                        </button>
                      </div>
                      <div className="ch-actions-right">
                        <div className="ch-status">
                          {sessions.some((s) => s.channelId === channel.id) ? (
                            <>
                              <div className="live-dot" />
                              <span className="ch-status-live">LIVE</span>
                            </>
                          ) : (
                            <span className="ch-status-offline">offline</span>
                          )}
                        </div>
                        <div className="ch-actions">
                          <button
                            className="action-btn"
                            disabled={testingId === channel.id}
                            onClick={() => void handleTestChannel(channel.id)}
                          >
                            {testingId === channel.id ? '[...]' : '[test]'}
                          </button>
                          <button className="action-btn" onClick={() => void handleToggle(channel)}>
                            {channel.enabled ? '[off]' : '[on]'}
                          </button>
                          <button
                            className="action-btn action-btn--danger"
                            onClick={() => void handleDelete(channel.id)}
                          >
                            [rm]
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>


          </div>
        ) : (
          <div className="live-stage">
            <div className="live-canvas" ref={liveCanvasRef} />
          </div>
        )}
      </main>

      {loading && <div className="loading-splash">booting_control_room...</div>}
    </div>
  );
}
