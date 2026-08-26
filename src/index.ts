import { loadConfig } from './config.js';
import { createLogger } from './utils/logger.js';
import { Database } from './database/Database.js';
import { createContext } from './services/index.js';
import { Events } from 'discord.js';
import { createClient } from './bot/client.js';
import { registerEvents } from './bot/events.js';
import { registerCommands } from './bot/commands.js';
import { DiscordReminderDelivery, ReminderWorker } from './workers/ReminderWorker.js';

/**
 * Ponto de entrada do SquadBot.
 *
 * Ordem de inicializacao:
 *   config -> banco (migrations) -> client -> comandos -> worker de lembretes.
 * Qualquer falha antes do login derruba o processo com codigo 1, para que o
 * orquestrador (Docker/Railway) reinicie em vez de rodar pela metade.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel, pretty: !config.isProduction });

  logger.info('Bot iniciado', {
    nodeEnv: config.nodeEnv,
    nodeVersion: process.version,
    reminderIntervalMs: config.reminderIntervalMs,
    defaultTimezone: config.defaultTimezone,
  });

  const db = new Database({ filePath: config.databasePath, logger });
  const context = createContext(db, config, logger);

  const client = createClient();
  registerEvents(client, context);

  await registerCommands(config, logger);

  const worker = new ReminderWorker(context, new DiscordReminderDelivery(client));

  client.once(Events.ClientReady, () => {
    worker.start();
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info('Encerrando SquadBot', { signal });
    worker.stop();
    await client.destroy().catch(() => undefined);
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Promise rejeitada sem tratamento', { error: reason });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Excecao nao tratada', { error });
  });

  await client.login(config.discordToken);
}

main().catch((error: unknown) => {
  // Aqui o logger pode ainda nao existir (falha ao carregar a config).
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Falha ao iniciar o SquadBot',
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    }),
  );
  process.exit(1);
});
