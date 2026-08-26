import { loadConfig } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { registerCommands, commandNames } from '../bot/commands.js';

/**
 * Registra os slash commands sem subir o bot.
 *
 *   npm run deploy:commands:dev   (TypeScript direto, via tsx)
 *   npm run deploy:commands       (JavaScript compilado)
 *
 * Com DISCORD_GUILD_ID definido, o registro é por servidor e propaga na hora.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel, pretty: !config.isProduction });

  logger.info('Registrando comandos', { commands: commandNames() });
  const total = await registerCommands(config, logger);
  logger.info('Registro concluido', { total });
}

main().catch((error: unknown) => {
  console.error('Falha ao registrar comandos:', error instanceof Error ? error.message : error);
  process.exit(1);
});
