import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventLog } from '@shared/types';

type LevelFilter = 'all' | EventLog['level'];

const LEVELS: LevelFilter[] = ['all', 'info', 'warn', 'error'];

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleTimeString(undefined, { hour12: false }) +
    '.' + String(date.getMilliseconds()).padStart(3, '0');
}

function formatMetadata(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function LogsView({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<string>('');
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.lurkBuddy.logs.list();
      setLogs(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const scopes = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) set.add(log.scope);
    return [...set].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (scopeFilter && log.scope !== scopeFilter) return false;
      if (q) {
        const haystack = `${log.message} ${log.metadata ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, levelFilter, scopeFilter, query]);

  const counts = useMemo(() => {
    const c: Record<EventLog['level'], number> = { info: 0, warn: 0, error: 0 };
    for (const log of logs) c[log.level] += 1;
    return c;
  }, [logs]);

  return (
    <div className="logs-overlay" onClick={onClose}>
      <div className="logs-panel" onClick={(e) => e.stopPropagation()}>
        <div className="logs-header">
          <div className="logs-title">
            <span className="sec-label">event_logs</span>
            <span className="logs-counts">
              <span className="logs-count logs-count--info">info {counts.info}</span>
              <span className="logs-count logs-count--warn">warn {counts.warn}</span>
              <span className="logs-count logs-count--error">error {counts.error}</span>
            </span>
          </div>
          <div className="logs-actions">
            <button className="ghost-btn" onClick={() => void refresh()} disabled={loading}>
              {loading ? '[loading...]' : '[reload]'}
            </button>
            <button className="ghost-btn" onClick={onClose}>
              [close]
            </button>
          </div>
        </div>

        <div className="logs-filters">
          <div className="logs-filter-group">
            {LEVELS.map((level) => (
              <button
                key={level}
                className={`logs-chip ${levelFilter === level ? 'active' : ''}`}
                onClick={() => setLevelFilter(level)}
              >
                {level}
              </button>
            ))}
          </div>
          <select
            className="logs-select"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            <option value="">all scopes</option>
            {scopes.map((scope) => (
              <option key={scope} value={scope}>{scope}</option>
            ))}
          </select>
          <input
            className="logs-search"
            type="text"
            placeholder="filter message or metadata..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="logs-body">
          {filtered.length === 0 ? (
            <div className="logs-empty">
              {loading ? 'loading logs...' : logs.length === 0 ? 'no logs yet.' : 'no logs match the current filters.'}
            </div>
          ) : (
            <div className="logs-list">
              {filtered.map((log) => {
                const metadata = formatMetadata(log.metadata);
                return (
                  <div key={log.id} className={`log-row log-row--${log.level}`}>
                    <div className="log-row-head">
                      <span className="log-time">{formatTime(log.createdAt)}</span>
                      <span className={`log-level log-level--${log.level}`}>{log.level}</span>
                      <span className="log-scope">{log.scope}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                    {metadata && (
                      <pre className="log-metadata">{metadata}</pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="logs-footer">
          {filtered.length} of {logs.length} log entries · press ESC to close
        </div>
      </div>
    </div>
  );
}
