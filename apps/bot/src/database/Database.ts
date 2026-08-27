import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { runMigrations, currentSchemaVersion } from './migrations.js';
import type { Logger } from '../utils/logger.js';

export interface DatabaseOptions {
  /** Caminho do arquivo `.db` ou `:memory:` (usado nos testes). */
  filePath: string;
  logger?: Logger;
}

/**
 * Conexao central com o SQLite.
 *
 * Regras do projeto:
 * - todo acesso passa por prepared statements (`db.prepare`);
 * - valores fornecidos pelo usuario NUNCA sao concatenados em SQL;
 * - escritas relacionadas rodam dentro de `transaction()`.
 */
export class Database {
  public readonly raw: BetterSqlite3.Database;
  private readonly statements = new Map<string, BetterSqlite3.Statement>();

  constructor(options: DatabaseOptions) {
    const { filePath, logger } = options;

    if (filePath !== ':memory:') {
      const directory = path.dirname(filePath);
      fs.mkdirSync(directory, { recursive: true });
    }

    this.raw = new BetterSqlite3(filePath);
    this.raw.pragma('journal_mode = WAL');
    this.raw.pragma('foreign_keys = ON');
    this.raw.pragma('busy_timeout = 5000');

    const applied = runMigrations(this.raw);

    logger?.info('Banco conectado', {
      path: filePath === ':memory:' ? ':memory:' : path.basename(filePath),
      schemaVersion: currentSchemaVersion(),
      migrationsApplied: applied,
    });
  }

  /** Cache de prepared statements — evita recompilar o mesmo SQL a cada chamada. */
  prepare<Params extends unknown[] | Record<string, unknown>, Result = unknown>(
    sql: string,
  ): BetterSqlite3.Statement<Params, Result> {
    const cached = this.statements.get(sql);
    if (cached) return cached as BetterSqlite3.Statement<Params, Result>;

    const statement = this.raw.prepare(sql);
    this.statements.set(sql, statement);
    return statement as BetterSqlite3.Statement<Params, Result>;
  }

  /** Executa `fn` dentro de uma transacao (rollback automatico em caso de erro). */
  transaction<T>(fn: () => T): T {
    return this.raw.transaction(fn)();
  }

  close(): void {
    this.statements.clear();
    this.raw.close();
  }
}
