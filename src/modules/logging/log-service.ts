import type Database from 'better-sqlite3';
import type { EventLog } from '../../shared/types.js';
import { makeId, nowIso } from '../../shared/utils.js';

export class LogService {
  constructor(private readonly db: Database.Database) {}

  list(limit = 200): EventLog[] {
    return this.db
      .prepare(
        `SELECT id, level, scope, message, metadata, created_at AS createdAt
         FROM event_logs
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(limit) as EventLog[];
  }

  write(level: EventLog['level'], scope: string, message: string, metadata?: unknown): void {
    this.db
      .prepare(
        `INSERT INTO event_logs (id, level, scope, message, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(makeId(), level, scope, message, metadata ? JSON.stringify(metadata) : null, nowIso());
  }
}
