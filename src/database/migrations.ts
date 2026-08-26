import type BetterSqlite3 from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: BetterSqlite3.Database) => void;
}

/**
 * Migrations sao aplicadas em ordem e controladas pelo `PRAGMA user_version`.
 * Cada migration roda dentro de uma transacao: ou aplica inteira, ou nada.
 * NUNCA edite uma migration ja publicada — adicione uma nova.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'schema_inicial',
    up(db) {
      db.exec(`
        CREATE TABLE users (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          discord_id  TEXT NOT NULL,
          server_id   TEXT NOT NULL,
          username    TEXT NOT NULL,
          timezone    TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL,
          UNIQUE (server_id, discord_id)
        );

        CREATE INDEX idx_users_server ON users (server_id);

        CREATE TABLE server_settings (
          server_id   TEXT PRIMARY KEY,
          timezone    TEXT NOT NULL,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );

        CREATE TABLE projects (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id   TEXT NOT NULL,
          name        TEXT NOT NULL COLLATE NOCASE,
          description TEXT,
          status      TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived')),
          created_by  INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL,
          UNIQUE (server_id, name)
        );

        CREATE INDEX idx_projects_server_status ON projects (server_id, status);

        CREATE TABLE project_members (
          project_id  INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
          user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
          joined_at   TEXT NOT NULL,
          PRIMARY KEY (project_id, user_id)
        );

        CREATE INDEX idx_project_members_user ON project_members (user_id);

        CREATE TABLE items (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id   TEXT NOT NULL,
          project_id  INTEGER REFERENCES projects (id) ON DELETE SET NULL,
          created_by  INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
          assigned_to INTEGER REFERENCES users (id) ON DELETE SET NULL,
          type        TEXT NOT NULL
                        CHECK (type IN ('task', 'note', 'idea', 'decision', 'link')),
          title       TEXT NOT NULL,
          content     TEXT,
          status      TEXT NOT NULL,
          priority    TEXT CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent')),
          due_at      TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );

        CREATE INDEX idx_items_server_type ON items (server_id, type, status);
        CREATE INDEX idx_items_project ON items (project_id);
        CREATE INDEX idx_items_assigned ON items (server_id, assigned_to, status);
        CREATE INDEX idx_items_due ON items (server_id, due_at);

        CREATE TABLE reminders (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id    TEXT NOT NULL,
          created_by   INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
          recipient_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
          item_id      INTEGER REFERENCES items (id) ON DELETE SET NULL,
          message      TEXT NOT NULL,
          remind_at    TEXT NOT NULL,
          sent         INTEGER NOT NULL DEFAULT 0 CHECK (sent IN (0, 1)),
          created_at   TEXT NOT NULL,
          sent_at      TEXT
        );

        CREATE INDEX idx_reminders_pending ON reminders (sent, remind_at);
        CREATE INDEX idx_reminders_recipient ON reminders (server_id, recipient_id, sent);
      `);
    },
  },
];

export function currentSchemaVersion(): number {
  return migrations.reduce((max, migration) => Math.max(max, migration.version), 0);
}

/**
 * Aplica todas as migrations pendentes. Idempotente: pode ser chamada a cada boot.
 * Retorna as versoes efetivamente aplicadas nesta execucao.
 */
export function runMigrations(db: BetterSqlite3.Database): number[] {
  const applied: number[] = [];
  const versionRow = db.pragma('user_version', { simple: true });
  let version = typeof versionRow === 'number' ? versionRow : 0;

  const pending = [...migrations]
    .sort((a, b) => a.version - b.version)
    .filter((migration) => migration.version > version);

  for (const migration of pending) {
    const apply = db.transaction(() => {
      migration.up(db);
    });
    apply();
    // PRAGMA nao aceita parametro vinculado; o valor vem do codigo, nunca do usuario.
    db.pragma(`user_version = ${migration.version}`);
    version = migration.version;
    applied.push(migration.version);
  }

  return applied;
}
