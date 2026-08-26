import type { Database } from '../Database.js';
import type { ProjectMemberRow, ProjectRow, ProjectStatus, UserRow } from '../../types/index.js';
import { nowIso } from '../../utils/dates.js';

export interface CreateProjectInput {
  serverId: string;
  name: string;
  description: string | null;
  createdBy: number;
}

export class ProjectRepository {
  constructor(private readonly db: Database) {}

  create(input: CreateProjectInput): ProjectRow {
    const timestamp = nowIso();
    const result = this.db
      .prepare<[string, string, string | null, number, string, string]>(
        `INSERT INTO projects (server_id, name, description, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      )
      .run(input.serverId, input.name, input.description, input.createdBy, timestamp, timestamp);

    return this.findById(Number(result.lastInsertRowid)) as ProjectRow;
  }

  findById(id: number): ProjectRow | undefined {
    return this.db.prepare<[number], ProjectRow>('SELECT * FROM projects WHERE id = ?').get(id);
  }

  /** Busca escopada ao servidor — nunca retorna projeto de outro servidor. */
  findByIdInServer(id: number, serverId: string): ProjectRow | undefined {
    return this.db
      .prepare<[number, string], ProjectRow>('SELECT * FROM projects WHERE id = ? AND server_id = ?')
      .get(id, serverId);
  }

  findByName(serverId: string, name: string): ProjectRow | undefined {
    return this.db
      .prepare<[string, string], ProjectRow>(
        'SELECT * FROM projects WHERE server_id = ? AND name = ? COLLATE NOCASE',
      )
      .get(serverId, name);
  }

  listByServer(serverId: string, status?: ProjectStatus): ProjectRow[] {
    if (status) {
      return this.db
        .prepare<[string, string], ProjectRow>(
          'SELECT * FROM projects WHERE server_id = ? AND status = ? ORDER BY name COLLATE NOCASE',
        )
        .all(serverId, status);
    }
    return this.db
      .prepare<[string], ProjectRow>(
        `SELECT * FROM projects WHERE server_id = ?
         ORDER BY status = 'archived', name COLLATE NOCASE`,
      )
      .all(serverId);
  }

  /** Autocomplete: busca por prefixo/substring, com escape de curingas do LIKE. */
  searchByName(serverId: string, term: string, limit = 25): ProjectRow[] {
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    return this.db
      .prepare<[string, string, number], ProjectRow>(
        `SELECT * FROM projects
         WHERE server_id = ? AND name LIKE ? ESCAPE '\\'
         ORDER BY status = 'archived', name COLLATE NOCASE
         LIMIT ?`,
      )
      .all(serverId, pattern, limit);
  }

  updateStatus(id: number, status: ProjectStatus): ProjectRow | undefined {
    this.db
      .prepare<[string, string, number]>(
        'UPDATE projects SET status = ?, updated_at = ? WHERE id = ?',
      )
      .run(status, nowIso(), id);
    return this.findById(id);
  }

  updateDescription(id: number, description: string | null): ProjectRow | undefined {
    this.db
      .prepare<[string | null, string, number]>(
        'UPDATE projects SET description = ?, updated_at = ? WHERE id = ?',
      )
      .run(description, nowIso(), id);
    return this.findById(id);
  }

  addMember(projectId: number, userId: number): void {
    this.db
      .prepare<[number, number, string]>(
        `INSERT INTO project_members (project_id, user_id, joined_at)
         VALUES (?, ?, ?)
         ON CONFLICT (project_id, user_id) DO NOTHING`,
      )
      .run(projectId, userId, nowIso());
  }

  removeMember(projectId: number, userId: number): boolean {
    const result = this.db
      .prepare<[number, number]>('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
      .run(projectId, userId);
    return result.changes > 0;
  }

  isMember(projectId: number, userId: number): boolean {
    const row = this.db
      .prepare<[number, number], ProjectMemberRow>(
        'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
      )
      .get(projectId, userId);
    return row !== undefined;
  }

  listMembers(projectId: number): UserRow[] {
    return this.db
      .prepare<[number], UserRow>(
        `SELECT u.* FROM project_members pm
         JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = ?
         ORDER BY u.username COLLATE NOCASE`,
      )
      .all(projectId);
  }

  countMembers(projectId: number): number {
    const row = this.db
      .prepare<[number], { total: number }>(
        'SELECT COUNT(*) AS total FROM project_members WHERE project_id = ?',
      )
      .get(projectId);
    return row?.total ?? 0;
  }
}
