export const migrations = [
  `
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      channel_key TEXT NOT NULL,
      display_name TEXT NOT NULL,
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_poll_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_platform_key
      ON channels(platform, channel_key);

    CREATE INDEX IF NOT EXISTS idx_channels_enabled
      ON channels(enabled);
  `,
  `
    CREATE TABLE IF NOT EXISTS live_sessions (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      last_heartbeat_at TEXT,
      tab_id TEXT NOT NULL,
      stream_url TEXT NOT NULL,
      last_detected_title TEXT,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_live_sessions_status
      ON live_sessions(status);
  `,
  `
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS poll_runs (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS event_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      scope TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );
  `
] as const;
