import type Database from 'better-sqlite3';
import type { LiveSession } from '../../shared/types.js';

function hydrate(row: Record<string, unknown>): LiveSession {
  return {
    id: String(row.id),
    channelId: String(row.channel_id),
    platform: row.platform as LiveSession['platform'],
    status: row.status as LiveSession['status'],
    openedAt: String(row.opened_at),
    closedAt: row.closed_at ? String(row.closed_at) : null,
    lastHeartbeatAt: row.last_heartbeat_at ? String(row.last_heartbeat_at) : null,
    tabId: String(row.tab_id),
    streamUrl: String(row.stream_url),
    lastDetectedTitle: row.last_detected_title ? String(row.last_detected_title) : null,
    lastError: row.last_error ? String(row.last_error) : null
  };
}

export class LiveSessionRepository {
  constructor(private readonly db: Database.Database) {}

  list(): LiveSession[] {
    return this.db
      .prepare('SELECT * FROM live_sessions ORDER BY opened_at DESC')
      .all()
      .map((row) => hydrate(row as Record<string, unknown>));
  }

  getActive(): LiveSession[] {
    return this.db
      .prepare("SELECT * FROM live_sessions WHERE status IN ('opening', 'live', 'queued', 'ending')")
      .all()
      .map((row) => hydrate(row as Record<string, unknown>));
  }

  getByChannelId(channelId: string): LiveSession | null {
    const row = this.db
      .prepare(
        "SELECT * FROM live_sessions WHERE channel_id = ? AND status IN ('opening', 'live', 'queued', 'ending') ORDER BY opened_at DESC LIMIT 1"
      )
      .get(channelId) as Record<string, unknown> | undefined;
    return row ? hydrate(row) : null;
  }

  getAllActiveByChannelId(channelId: string): LiveSession[] {
    return this.db
      .prepare(
        "SELECT * FROM live_sessions WHERE channel_id = ? AND status IN ('opening', 'live', 'queued', 'ending') ORDER BY opened_at DESC"
      )
      .all(channelId)
      .map((row) => hydrate(row as Record<string, unknown>));
  }

  getByChannelAndUrl(channelId: string, streamUrl: string): LiveSession | null {
    const row = this.db
      .prepare(
        "SELECT * FROM live_sessions WHERE channel_id = ? AND stream_url = ? AND status IN ('opening', 'live', 'queued', 'ending') ORDER BY opened_at DESC LIMIT 1"
      )
      .get(channelId, streamUrl) as Record<string, unknown> | undefined;
    return row ? hydrate(row) : null;
  }

  save(session: LiveSession): LiveSession {
    this.db
      .prepare(
        `INSERT INTO live_sessions (
          id, channel_id, platform, status, opened_at, closed_at, last_heartbeat_at,
          tab_id, stream_url, last_detected_title, last_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.channelId,
        session.platform,
        session.status,
        session.openedAt,
        session.closedAt,
        session.lastHeartbeatAt,
        session.tabId,
        session.streamUrl,
        session.lastDetectedTitle,
        session.lastError
      );
    return session;
  }

  update(session: LiveSession): LiveSession {
    this.db
      .prepare(
        `UPDATE live_sessions
         SET status = ?, closed_at = ?, last_heartbeat_at = ?, stream_url = ?, last_detected_title = ?, last_error = ?
         WHERE id = ?`
      )
      .run(
        session.status,
        session.closedAt,
        session.lastHeartbeatAt,
        session.streamUrl,
        session.lastDetectedTitle,
        session.lastError,
        session.id
      );
    return session;
  }
}
