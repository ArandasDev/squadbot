import type { Database } from '../Database.js';
import type { UserRow } from '../../types/index.js';
import { nowIso } from '../../utils/dates.js';

/**
 * Usuarios sao sempre escopados por servidor: o mesmo `discord_id` em dois
 * servidores gera duas linhas independentes (timezone e dados nao vazam entre eles).
 */
export class UserRepository {
  constructor(private readonly db: Database) {}

  findById(id: number): UserRow | undefined {
    return this.db
      .prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?')
      .get(id);
  }

  findByDiscordId(serverId: string, discordId: string): UserRow | undefined {
    return this.db
      .prepare<[string, string], UserRow>(
        'SELECT * FROM users WHERE server_id = ? AND discord_id = ?',
      )
      .get(serverId, discordId);
  }

  /**
   * Garante que o usuario exista no servidor, mantendo o `username` atualizado.
   * É o ponto de entrada usado por todo comando antes de qualquer escrita.
   */
  ensure(serverId: string, discordId: string, username: string, timezone: string): UserRow {
    const existing = this.findByDiscordId(serverId, discordId);
    const timestamp = nowIso();

    if (existing) {
      if (existing.username !== username) {
        this.db
          .prepare<[string, string, number]>(
            'UPDATE users SET username = ?, updated_at = ? WHERE id = ?',
          )
          .run(username, timestamp, existing.id);
        return { ...existing, username, updated_at: timestamp };
      }
      return existing;
    }

    const result = this.db
      .prepare<[string, string, string, string, string, string]>(
        `INSERT INTO users (discord_id, server_id, username, timezone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(discordId, serverId, username, timezone, timestamp, timestamp);

    return this.findById(Number(result.lastInsertRowid)) as UserRow;
  }

  updateTimezone(id: number, timezone: string): UserRow | undefined {
    this.db
      .prepare<[string, string, number]>(
        'UPDATE users SET timezone = ?, updated_at = ? WHERE id = ?',
      )
      .run(timezone, nowIso(), id);
    return this.findById(id);
  }

  listByServer(serverId: string): UserRow[] {
    return this.db
      .prepare<[string], UserRow>(
        'SELECT * FROM users WHERE server_id = ? ORDER BY username COLLATE NOCASE',
      )
      .all(serverId);
  }
}
