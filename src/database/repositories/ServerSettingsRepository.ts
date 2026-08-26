import type { Database } from '../Database.js';
import { nowIso } from '../../utils/dates.js';

export interface ServerSettingsRow {
  server_id: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

/**
 * Configuracao por servidor. Hoje guarda apenas o timezone padrao usado quando
 * um usuario ainda nao definiu o dele.
 */
export class ServerSettingsRepository {
  constructor(private readonly db: Database) {}

  find(serverId: string): ServerSettingsRow | undefined {
    return this.db
      .prepare<[string], ServerSettingsRow>('SELECT * FROM server_settings WHERE server_id = ?')
      .get(serverId);
  }

  upsertTimezone(serverId: string, timezone: string): ServerSettingsRow {
    const timestamp = nowIso();
    this.db
      .prepare<[string, string, string, string]>(
        `INSERT INTO server_settings (server_id, timezone, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (server_id) DO UPDATE SET timezone = excluded.timezone, updated_at = excluded.updated_at`,
      )
      .run(serverId, timezone, timestamp, timestamp);

    return this.find(serverId) as ServerSettingsRow;
  }
}
