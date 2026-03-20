import Database from 'better-sqlite3';
import * as electron from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { migrations } from './migrations.js';
import { DEFAULT_SETTINGS } from '../shared/constants.js';

const { app } = electron;

export function resolveDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true });
  }
  return join(userDataPath, 'lurk-buddy.db');
}

export function createDatabase(): Database.Database {
  const dbPath = resolveDatabasePath();
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const migrate = db.transaction(() => {
    for (const sql of migrations) {
      db.exec(sql);
    }
    dropLegacyChannelColumns(db);
    const settingsRow = db
      .prepare('SELECT id FROM app_settings WHERE id = 1')
      .get() as { id: number } | undefined;
    if (!settingsRow) {
      db.prepare('INSERT INTO app_settings (id, payload) VALUES (1, ?)').run(
        JSON.stringify(DEFAULT_SETTINGS)
      );
    }
  });

  migrate();
  return db;
}

function dropLegacyChannelColumns(db: Database.Database): void {
  const columns = db
    .prepare('PRAGMA table_info(channels)')
    .all() as Array<{ name: string }>;

  const hasLegacyColumns = columns.some((column) =>
    column.name === 'poll_interval_minutes' || column.name === 'priority'
  );

  if (!hasLegacyColumns) {
    return;
  }

  db.exec(`
    ALTER TABLE channels RENAME TO channels_legacy;

    CREATE TABLE channels (
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

    INSERT INTO channels (
      id, platform, channel_key, display_name, url, enabled, created_at, updated_at, last_poll_at
    )
    SELECT
      id, platform, channel_key, display_name, url, enabled, created_at, updated_at, last_poll_at
    FROM channels_legacy;

    DROP TABLE channels_legacy;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_platform_key
      ON channels(platform, channel_key);

    CREATE INDEX IF NOT EXISTS idx_channels_enabled
      ON channels(enabled);
  `);
}
