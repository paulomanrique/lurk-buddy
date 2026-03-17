import type Database from 'better-sqlite3';
import { makeId, nowIso } from '../../shared/utils.js';

export class PollRunRepository {
  constructor(private readonly db: Database.Database) {}

  record(channelId: string, status: 'live' | 'offline' | 'error', detail?: string): void {
    this.db
      .prepare(
        'INSERT INTO poll_runs (id, channel_id, status, detail, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(makeId(), channelId, status, detail ?? null, nowIso());
  }
}
