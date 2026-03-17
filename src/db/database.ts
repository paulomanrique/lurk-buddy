import Database from 'better-sqlite3';
import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { migrations } from './migrations.js';
import { DEFAULT_SETTINGS } from '../shared/constants.js';

export function createDatabase(): Database.Database {
  const userDataPath = app.getPath('userData');
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true });
  }
  const dbPath = join(userDataPath, 'lurk-buddy.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const migrate = db.transaction(() => {
    for (const sql of migrations) {
      db.exec(sql);
    }
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
