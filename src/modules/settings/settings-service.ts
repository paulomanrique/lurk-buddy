import type Database from 'better-sqlite3';
import type { AppSettings } from '../../shared/types.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';

export class SettingsService {
  constructor(private readonly db: Database.Database) {}

  get(): AppSettings {
    const row = this.db.prepare('SELECT payload FROM app_settings WHERE id = 1').get() as
      | { payload: string }
      | undefined;
    if (!row) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.payload) } as AppSettings;
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const merged = { ...this.get(), ...patch };
    this.db
      .prepare('UPDATE app_settings SET payload = ? WHERE id = 1')
      .run(JSON.stringify(merged));
    return merged;
  }
}
