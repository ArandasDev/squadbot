import type { AppConfig } from '../src/config.js';
import { Database } from '../src/database/Database.js';
import { createContext, type AppContext } from '../src/services/index.js';
import { createLogger } from '../src/utils/logger.js';
import type { UserRow } from '../src/types/index.js';

export const SERVER_A = '111111111111111111';
export const SERVER_B = '222222222222222222';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    discordToken: 'test-token',
    discordClientId: '000000000000000000',
    discordGuildId: null,
    databasePath: ':memory:',
    defaultTimezone: 'America/Sao_Paulo',
    nodeEnv: 'test',
    reminderIntervalMs: 30_000,
    logLevel: 'error',
    isProduction: false,
    ...overrides,
  };
}

/** Contexto completo sobre um SQLite em memoria — rapido e isolado por teste. */
export function createTestContext(overrides: Partial<AppConfig> = {}): AppContext {
  const config = testConfig(overrides);
  const logger = createLogger({ level: 'error', pretty: false, silent: true });
  const db = new Database({ filePath: ':memory:' });
  return createContext(db, config, logger);
}

let discordIdCounter = 100000000000000000n;

/** Cria (ou recupera) um usuario do servidor informado. */
export function makeUser(
  context: AppContext,
  serverId: string,
  username: string,
  discordId?: string,
): UserRow {
  const id = discordId ?? String(++discordIdCounter);
  return context.services.users.ensure(serverId, { discordId: id, username });
}
