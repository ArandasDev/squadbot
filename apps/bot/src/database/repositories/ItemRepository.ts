import type { Database } from '../Database.js';
import type {
  CreateItemInput,
  ItemRow,
  ItemType,
  ListItemsFilter,
  Priority,
} from '../../types/index.js';
import { nowIso } from '../../utils/dates.js';

export interface UpdateItemPatch {
  title?: string;
  content?: string | null;
  status?: string;
  priority?: Priority | null;
  dueAt?: string | null;
  projectId?: number | null;
  assignedTo?: number | null;
}

/** Item + nome do projeto, para listagens sem N+1. */
export interface ItemWithProject extends ItemRow {
  project_name: string | null;
  creator_discord_id: string;
  assignee_discord_id: string | null;
}

const WITH_JOINS = `
  SELECT i.*,
         p.name AS project_name,
         cu.discord_id AS creator_discord_id,
         au.discord_id AS assignee_discord_id
  FROM items i
  LEFT JOIN projects p ON p.id = i.project_id
  JOIN users cu ON cu.id = i.created_by
  LEFT JOIN users au ON au.id = i.assigned_to
`;

/** Escapa os curingas do LIKE para que `%` digitado pelo usuario seja literal. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}

export class ItemRepository {
  constructor(private readonly db: Database) {}

  create(input: CreateItemInput): ItemRow {
    const timestamp = nowIso();
    const result = this.db
      .prepare<
        [
          string,
          number | null,
          number,
          number | null,
          string,
          string,
          string | null,
          string,
          string | null,
          string | null,
          string,
          string,
        ]
      >(
        `INSERT INTO items
           (server_id, project_id, created_by, assigned_to, type, title, content,
            status, priority, due_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.serverId,
        input.projectId,
        input.createdBy,
        input.assignedTo ?? null,
        input.type,
        input.title,
        input.content ?? null,
        input.status,
        input.priority ?? null,
        input.dueAt ?? null,
        timestamp,
        timestamp,
      );

    return this.findById(Number(result.lastInsertRowid)) as ItemRow;
  }

  findById(id: number): ItemRow | undefined {
    return this.db.prepare<[number], ItemRow>('SELECT * FROM items WHERE id = ?').get(id);
  }

  /** Sempre prefira esta versao nos comandos: garante isolamento entre servidores. */
  findByIdInServer(id: number, serverId: string): ItemRow | undefined {
    return this.db
      .prepare<[number, string], ItemRow>('SELECT * FROM items WHERE id = ? AND server_id = ?')
      .get(id, serverId);
  }

  findDetailedByIdInServer(id: number, serverId: string): ItemWithProject | undefined {
    return this.db
      .prepare<[number, string], ItemWithProject>(
        `${WITH_JOINS} WHERE i.id = ? AND i.server_id = ?`,
      )
      .get(id, serverId);
  }

  /**
   * Monta a clausula WHERE dinamicamente, mas SEMPRE com placeholders:
   * nenhum valor vindo do usuario entra na string de SQL.
   */
  private buildFilter(filter: ListItemsFilter): { where: string; params: unknown[] } {
    const clauses: string[] = ['i.server_id = ?'];
    const params: unknown[] = [filter.serverId];

    if (filter.type) {
      clauses.push('i.type = ?');
      params.push(filter.type);
    }
    if (filter.projectId !== undefined) {
      if (filter.projectId === null) {
        clauses.push('i.project_id IS NULL');
      } else {
        clauses.push('i.project_id = ?');
        params.push(filter.projectId);
      }
    }
    if (filter.assignedTo !== undefined) {
      clauses.push('i.assigned_to = ?');
      params.push(filter.assignedTo);
    }
    if (filter.createdBy !== undefined) {
      clauses.push('i.created_by = ?');
      params.push(filter.createdBy);
    }
    if (filter.status !== undefined) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (statuses.length > 0) {
        clauses.push(`i.status IN (${statuses.map(() => '?').join(', ')})`);
        params.push(...statuses);
      }
    }
    if (filter.notStatus !== undefined) {
      const statuses = Array.isArray(filter.notStatus) ? filter.notStatus : [filter.notStatus];
      if (statuses.length > 0) {
        clauses.push(`i.status NOT IN (${statuses.map(() => '?').join(', ')})`);
        params.push(...statuses);
      }
    }

    return { where: clauses.join(' AND '), params };
  }

  list(filter: ListItemsFilter): ItemWithProject[] {
    const { where, params } = this.buildFilter(filter);
    const limit = filter.limit ?? 200;
    const offset = filter.offset ?? 0;

    return this.db
      .prepare<unknown[], ItemWithProject>(
        `${WITH_JOINS}
         WHERE ${where}
         ORDER BY
           CASE i.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
                           WHEN 'low' THEN 3 ELSE 4 END,
           i.due_at IS NULL,
           i.due_at,
           i.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset);
  }

  count(filter: ListItemsFilter): number {
    const { where, params } = this.buildFilter(filter);
    const row = this.db
      .prepare<unknown[], { total: number }>(
        `SELECT COUNT(*) AS total FROM items i WHERE ${where}`,
      )
      .get(...params);
    return row?.total ?? 0;
  }

  /** Contagem por status para o `/resumo` — uma query por projeto, nao por status. */
  countTasksByStatus(serverId: string, projectId: number | null): Record<string, number> {
    const rows =
      projectId === null
        ? this.db
            .prepare<[string], { status: string; total: number }>(
              `SELECT status, COUNT(*) AS total FROM items
               WHERE server_id = ? AND type = 'task' AND project_id IS NULL
               GROUP BY status`,
            )
            .all(serverId)
        : this.db
            .prepare<[string, number], { status: string; total: number }>(
              `SELECT status, COUNT(*) AS total FROM items
               WHERE server_id = ? AND type = 'task' AND project_id = ?
               GROUP BY status`,
            )
            .all(serverId, projectId);

    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.status] = row.total;
    return counts;
  }

  update(id: number, patch: UpdateItemPatch): ItemRow | undefined {
    const assignments: string[] = [];
    const params: unknown[] = [];

    if (patch.title !== undefined) {
      assignments.push('title = ?');
      params.push(patch.title);
    }
    if (patch.content !== undefined) {
      assignments.push('content = ?');
      params.push(patch.content);
    }
    if (patch.status !== undefined) {
      assignments.push('status = ?');
      params.push(patch.status);
    }
    if (patch.priority !== undefined) {
      assignments.push('priority = ?');
      params.push(patch.priority);
    }
    if (patch.dueAt !== undefined) {
      assignments.push('due_at = ?');
      params.push(patch.dueAt);
    }
    if (patch.projectId !== undefined) {
      assignments.push('project_id = ?');
      params.push(patch.projectId);
    }
    if (patch.assignedTo !== undefined) {
      assignments.push('assigned_to = ?');
      params.push(patch.assignedTo);
    }

    if (assignments.length === 0) return this.findById(id);

    assignments.push('updated_at = ?');
    params.push(nowIso(), id);

    this.db.prepare<unknown[]>(`UPDATE items SET ${assignments.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  remove(id: number): boolean {
    const result = this.db.prepare<[number]>('DELETE FROM items WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Busca textual em titulo e conteudo. Sempre escopada pelo `server_id`
   * — informacao de um servidor nunca aparece em outro.
   */
  search(serverId: string, term: string, types?: readonly ItemType[], limit = 50): ItemWithProject[] {
    const pattern = likePattern(term);
    const typeList = types && types.length > 0 ? types : null;
    const typeClause = typeList ? `AND i.type IN (${typeList.map(() => '?').join(', ')})` : '';
    const params: unknown[] = [serverId, pattern, pattern];
    if (typeList) params.push(...typeList);
    params.push(limit);

    return this.db
      .prepare<unknown[], ItemWithProject>(
        `${WITH_JOINS}
         WHERE i.server_id = ?
           AND (i.title LIKE ? ESCAPE '\\' OR IFNULL(i.content, '') LIKE ? ESCAPE '\\')
           ${typeClause}
         ORDER BY i.updated_at DESC
         LIMIT ?`,
      )
      .all(...params);
  }

  /** Autocomplete de itens de um tipo, opcionalmente filtrando status. */
  autocomplete(
    serverId: string,
    type: ItemType,
    term: string,
    options: { excludeStatus?: readonly string[]; limit?: number } = {},
  ): ItemRow[] {
    const pattern = likePattern(term);
    const exclude = options.excludeStatus ?? [];
    const excludeClause =
      exclude.length > 0 ? `AND status NOT IN (${exclude.map(() => '?').join(', ')})` : '';
    const params: unknown[] = [serverId, type, pattern];
    if (exclude.length > 0) params.push(...exclude);
    params.push(options.limit ?? 25);

    return this.db
      .prepare<unknown[], ItemRow>(
        `SELECT * FROM items
         WHERE server_id = ? AND type = ? AND title LIKE ? ESCAPE '\\'
         ${excludeClause}
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(...params);
  }
}
