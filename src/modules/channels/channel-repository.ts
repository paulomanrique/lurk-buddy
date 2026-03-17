import type Database from 'better-sqlite3';
import type { Channel } from '../../shared/types.js';

function hydrate(row: Record<string, unknown>): Channel {
  return {
    id: String(row.id),
    platform: row.platform as Channel['platform'],
    channelKey: String(row.channel_key),
    displayName: String(row.display_name),
    url: String(row.url),
    enabled: Boolean(row.enabled),
    pollIntervalMinutes: Number(row.poll_interval_minutes),
    priority: Number(row.priority),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastPollAt: row.last_poll_at ? String(row.last_poll_at) : null
  };
}

export class ChannelRepository {
  constructor(private readonly db: Database.Database) {}

  list(): Channel[] {
    return this.db
      .prepare("SELECT * FROM channels ORDER BY enabled DESC, LTRIM(channel_key, '@') COLLATE NOCASE ASC")
      .all()
      .map((row) => hydrate(row as Record<string, unknown>));
  }

  getById(id: string): Channel | null {
    const row = this.db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? hydrate(row) : null;
  }

  getByPlatformAndChannelKey(platform: Channel['platform'], channelKey: string): Channel | null {
    const row = this.db
      .prepare('SELECT * FROM channels WHERE platform = ? AND channel_key = ?')
      .get(platform, channelKey) as Record<string, unknown> | undefined;
    return row ? hydrate(row) : null;
  }

  getEnabled(): Channel[] {
    return this.db
      .prepare(
        'SELECT * FROM channels WHERE enabled = 1 ORDER BY priority DESC, updated_at DESC'
      )
      .all()
      .map((row) => hydrate(row as Record<string, unknown>));
  }

  save(channel: Channel): Channel {
    this.db
      .prepare(
        `INSERT INTO channels (
          id, platform, channel_key, display_name, url, enabled,
          poll_interval_minutes, priority, created_at, updated_at, last_poll_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        channel.id,
        channel.platform,
        channel.channelKey,
        channel.displayName,
        channel.url,
        channel.enabled ? 1 : 0,
        channel.pollIntervalMinutes,
        channel.priority,
        channel.createdAt,
        channel.updatedAt,
        channel.lastPollAt
      );
    return channel;
  }

  update(channel: Channel): Channel {
    this.db
      .prepare(
        `UPDATE channels
         SET display_name = ?, url = ?, enabled = ?, poll_interval_minutes = ?, priority = ?, updated_at = ?, last_poll_at = ?
         WHERE id = ?`
      )
      .run(
        channel.displayName,
        channel.url,
        channel.enabled ? 1 : 0,
        channel.pollIntervalMinutes,
        channel.priority,
        channel.updatedAt,
        channel.lastPollAt,
        channel.id
      );
    return channel;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM channels WHERE id = ?').run(id);
  }
}
