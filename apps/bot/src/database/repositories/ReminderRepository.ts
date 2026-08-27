import type { Database } from '../Database.js';
import type { CreateReminderInput, ReminderRow } from '../../types/index.js';
import { nowIso } from '../../utils/dates.js';

/** Lembrete + dados necessarios para entregar a mensagem no Discord. */
export interface ReminderWithTargets extends ReminderRow {
  recipient_discord_id: string;
  recipient_username: string;
  recipient_timezone: string;
  creator_discord_id: string;
  creator_username: string;
  creator_timezone: string;
  item_title: string | null;
}

const WITH_JOINS = `
  SELECT r.*,
         ru.discord_id AS recipient_discord_id,
         ru.username   AS recipient_username,
         ru.timezone   AS recipient_timezone,
         cu.discord_id AS creator_discord_id,
         cu.username   AS creator_username,
         cu.timezone   AS creator_timezone,
         i.title       AS item_title
  FROM reminders r
  JOIN users ru ON ru.id = r.recipient_id
  JOIN users cu ON cu.id = r.created_by
  LEFT JOIN items i ON i.id = r.item_id
`;

export class ReminderRepository {
  constructor(private readonly db: Database) {}

  create(input: CreateReminderInput): ReminderRow {
    const result = this.db
      .prepare<[string, number, number, number | null, string, string, string]>(
        `INSERT INTO reminders
           (server_id, created_by, recipient_id, item_id, message, remind_at, sent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .run(
        input.serverId,
        input.createdBy,
        input.recipientId,
        input.itemId ?? null,
        input.message,
        input.remindAt,
        nowIso(),
      );

    return this.findById(Number(result.lastInsertRowid)) as ReminderRow;
  }

  findById(id: number): ReminderRow | undefined {
    return this.db.prepare<[number], ReminderRow>('SELECT * FROM reminders WHERE id = ?').get(id);
  }

  findByIdInServer(id: number, serverId: string): ReminderRow | undefined {
    return this.db
      .prepare<[number, string], ReminderRow>(
        'SELECT * FROM reminders WHERE id = ? AND server_id = ?',
      )
      .get(id, serverId);
  }

  /**
   * Lembretes vencidos e ainda nao enviados.
   * Como tudo é gravado em UTC ISO 8601, a comparacao textual `<=` é correta.
   */
  listDue(nowUtcIso: string, limit = 50): ReminderWithTargets[] {
    return this.db
      .prepare<[string, number], ReminderWithTargets>(
        `${WITH_JOINS}
         WHERE r.sent = 0 AND r.remind_at <= ?
         ORDER BY r.remind_at
         LIMIT ?`,
      )
      .all(nowUtcIso, limit);
  }

  listUpcomingForUser(
    serverId: string,
    recipientId: number,
    limit = 10,
  ): ReminderWithTargets[] {
    return this.db
      .prepare<[string, number, number], ReminderWithTargets>(
        `${WITH_JOINS}
         WHERE r.server_id = ? AND r.recipient_id = ? AND r.sent = 0
         ORDER BY r.remind_at
         LIMIT ?`,
      )
      .all(serverId, recipientId, limit);
  }

  listUpcomingForServer(serverId: string, limit = 25): ReminderWithTargets[] {
    return this.db
      .prepare<[string, number], ReminderWithTargets>(
        `${WITH_JOINS}
         WHERE r.server_id = ? AND r.sent = 0
         ORDER BY r.remind_at
         LIMIT ?`,
      )
      .all(serverId, limit);
  }

  /** Lembretes que o usuario pode cancelar: criados por ele ou destinados a ele. */
  listCancellableForUser(
    serverId: string,
    userId: number,
    term: string,
    limit = 25,
  ): ReminderWithTargets[] {
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    return this.db
      .prepare<[string, number, number, string, number], ReminderWithTargets>(
        `${WITH_JOINS}
         WHERE r.server_id = ?
           AND r.sent = 0
           AND (r.created_by = ? OR r.recipient_id = ?)
           AND r.message LIKE ? ESCAPE '\\'
         ORDER BY r.remind_at
         LIMIT ?`,
      )
      .all(serverId, userId, userId, pattern, limit);
  }

  countPendingForServer(serverId: string): number {
    const row = this.db
      .prepare<[string], { total: number }>(
        'SELECT COUNT(*) AS total FROM reminders WHERE server_id = ? AND sent = 0',
      )
      .get(serverId);
    return row?.total ?? 0;
  }

  /**
   * Marca como enviado. O `AND sent = 0` torna a operacao idempotente: se duas
   * execucoes do worker se sobrepuserem, apenas uma marca (`changes === 1`).
   */
  markSent(id: number, sentAtIso = nowIso()): boolean {
    const result = this.db
      .prepare<[string, number]>('UPDATE reminders SET sent = 1, sent_at = ? WHERE id = ? AND sent = 0')
      .run(sentAtIso, id);
    return result.changes > 0;
  }

  remove(id: number): boolean {
    const result = this.db.prepare<[number]>('DELETE FROM reminders WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
