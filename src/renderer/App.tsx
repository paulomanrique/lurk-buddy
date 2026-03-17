import { useEffect, useState, type FormEvent } from 'react';
import type { AppSettings, Channel } from '@shared/types';
import { APP_NAME, BRAND_PRIMARY } from '@shared/constants';
import { EmptyState, PlatformBadge } from './components';
import { useAppStore } from './store';
import logoCircleUrl from './assets/logo-circle.svg';

const initialForm = { platform: 'twitch' as const, value: '', displayName: '', pollIntervalMinutes: 5, priority: 100 };

export function App() {
  const { channels, sessions, settings, logs, selectedSessionId, panelOnly, loading, hydrate, setSelectedSessionId, setPanelOnly } =
    useAppStore();
  const [form, setForm] = useState(initialForm);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
    return window.lurkBuddy.app.onStateChanged(() => {
      void hydrate();
    });
  }, [hydrate]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null;

  async function handleCreateChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await window.lurkBuddy.channels.create({
      platform: form.platform,
      value: form.value,
      displayName: form.displayName || undefined,
      pollIntervalMinutes: Number(form.pollIntervalMinutes),
      priority: Number(form.priority)
    });
    setForm(initialForm);
    await hydrate();
  }

  async function handleToggle(channel: Channel) {
    await window.lurkBuddy.channels.toggle(channel.id, !channel.enabled);
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
    await hydrate();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-panel">
          <div className="brand-mark" style={{ backgroundColor: BRAND_PRIMARY }}>
            <img src={logoCircleUrl} alt={`${APP_NAME} logo`} />
          </div>
          <div>
            <p className="eyebrow">Automated Lurk Control Room</p>
            <h1>{APP_NAME}</h1>
          </div>
        </div>

        <div className="tabs-header">
          <span>Live Tabs</span>
          <button className="ghost-button" onClick={() => setPanelOnly(!panelOnly)}>
            {panelOnly ? 'Show Tabs' : 'Panel Only'}
          </button>
        </div>

        <div className="tabs-list">
          {sessions.length === 0 ? (
            <EmptyState
              title="No live tabs"
              description="Polling runs in the background. When a tracked channel goes live, Lurk Buddy opens it here."
            />
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                className={`tab-item ${selectedSession?.id === session.id ? 'active' : ''}`}
                onClick={async () => {
                  setSelectedSessionId(session.id);
                  await window.lurkBuddy.lives.activate(session.id);
                }}
              >
                <div>
                  <strong>{channels.find((channel) => channel.id === session.channelId)?.displayName ?? 'Unknown'}</strong>
                  <span>{session.status}</span>
                </div>
                <div className="tab-actions">
                  <PlatformBadge platform={session.platform} />
                  <span
                    className="close-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleCloseSession(session.id);
                    }}
                  >
                    close
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="main-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">Status</p>
            <h2>{panelOnly ? 'Management Panel' : selectedSession ? 'Live Session Active' : 'Ready to Lurk'}</h2>
          </div>
          <div className="topbar-metrics">
            <div className="metric-card">
              <strong>{channels.length}</strong>
              <span>channels tracked</span>
            </div>
            <div className="metric-card">
              <strong>{sessions.length}</strong>
              <span>tabs active</span>
            </div>
          </div>
        </header>

        {panelOnly || !selectedSession ? (
          <section className="dashboard-grid">
            <div className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Channel Registry</p>
                  <h3>Add a channel</h3>
                </div>
              </div>
              <form className="channel-form" onSubmit={handleCreateChannel}>
                <select
                  value={form.platform}
                  onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value as Channel['platform'] }))}
                >
                  <option value="twitch">Twitch</option>
                  <option value="youtube">YouTube</option>
                  <option value="kick">Kick</option>
                </select>
                <input
                  placeholder="@channel or full URL"
                  value={form.value}
                  onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                />
                <input
                  placeholder="Display name"
                  value={form.displayName}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                />
                <input
                  type="number"
                  min={1}
                  max={60}
                  placeholder="Poll interval"
                  value={form.pollIntervalMinutes}
                  onChange={(event) => setForm((current) => ({ ...current, pollIntervalMinutes: Number(event.target.value) }))}
                />
                <input
                  type="number"
                  min={0}
                  max={999}
                  placeholder="Priority"
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: Number(event.target.value) }))}
                />
                <button className="primary-button" type="submit">
                  Add channel
                </button>
              </form>
            </div>

            <div className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Queue Control</p>
                  <h3>Tracked channels</h3>
                </div>
              </div>
              <div className="table">
                {channels.length === 0 ? (
                  <EmptyState
                    title="No channels yet"
                    description="Register Twitch, YouTube or Kick channels and Lurk Buddy will poll them every five minutes by default."
                  />
                ) : (
                  channels.map((channel) => (
                    <div className="table-row" key={channel.id}>
                      <div>
                        <strong>{channel.displayName}</strong>
                        <p>{channel.url}</p>
                      </div>
                      <div className="table-actions">
                        <PlatformBadge platform={channel.platform} />
                        <button className="ghost-button" onClick={() => void handleToggle(channel)}>
                          {channel.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          className="ghost-button"
                          disabled={testingId === channel.id}
                          onClick={() => void handleTestChannel(channel.id)}
                        >
                          {testingId === channel.id ? 'Testing...' : 'Test'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Defaults</p>
                  <h3>Settings</h3>
                </div>
              </div>
              {settings && (
                <div className="settings-grid">
                  <label>
                    Max concurrent lives
                    <input
                      type="number"
                      value={settings.maxConcurrentLives}
                      onChange={(event) =>
                        void handleSettingsChange({ maxConcurrentLives: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Poll interval (min)
                    <input
                      type="number"
                      value={settings.defaultPollIntervalMinutes}
                      onChange={(event) =>
                        void handleSettingsChange({
                          defaultPollIntervalMinutes: Number(event.target.value)
                        })
                      }
                    />
                  </label>
                  <label>
                    Grace period (sec)
                    <input
                      type="number"
                      value={settings.closeGracePeriodSeconds}
                      onChange={(event) =>
                        void handleSettingsChange({
                          closeGracePeriodSeconds: Number(event.target.value)
                        })
                      }
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={settings.enableFocusSpoof}
                      onChange={(event) =>
                        void handleSettingsChange({ enableFocusSpoof: event.target.checked })
                      }
                    />
                    Enable focus spoof
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={settings.enablePerTabMute}
                      onChange={(event) =>
                        void handleSettingsChange({ enablePerTabMute: event.target.checked })
                      }
                    />
                    Keep tabs muted in Electron
                  </label>
                </div>
              )}
            </div>

            <div className="card log-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Operations</p>
                  <h3>Recent logs</h3>
                </div>
              </div>
              <div className="log-list">
                {logs.map((log) => (
                  <div className="log-row" key={log.id}>
                    <span className={`log-level ${log.level}`}>{log.level}</span>
                    <div>
                      <strong>{log.message}</strong>
                      <p>{log.scope}</p>
                    </div>
                    <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="live-stage-card">
            <div className="live-stage-copy">
              <p className="eyebrow">Live playback is rendered in the native Electron view.</p>
              <h3>{channels.find((channel) => channel.id === selectedSession.channelId)?.displayName}</h3>
              <p>
                The player remains unmuted for the site while the Electron tab is muted at the container level.
                Focus and visibility spoofing stay enabled in preload.
              </p>
            </div>
          </section>
        )}
      </main>

      {loading && <div className="loading-splash">Booting control room...</div>}
    </div>
  );
}
