import { REST, Routes } from 'discord.js';
import { allCommands } from '../commands/index.js';
import type { SlashCommand } from '../commands/shared.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../utils/logger.js';

/** Mapa nome -> comando, usado pelo handler de interacoes. */
export const commandRegistry: ReadonlyMap<string, SlashCommand> = new Map(
  allCommands.map((command) => [command.data.name, command]),
);

export function commandNames(): string[] {
  return [...commandRegistry.keys()];
}

/** Payload JSON enviado a API do Discord no registro dos slash commands. */
export function commandPayload(): unknown[] {
  return allCommands.map((command) => command.data.toJSON());
}

/**
 * Registra os slash commands.
 *
 * Com `DISCORD_GUILD_ID` definido, registra apenas naquele servidor — a
 * propagacao é instantanea, ideal para desenvolvimento. Sem ele, registra
 * globalmente (o Discord leva ate ~1h para propagar).
 */
export async function registerCommands(config: AppConfig, logger: Logger): Promise<number> {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const body = commandPayload();

  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);

  await rest.put(route, { body });

  logger.info('Comandos registrados', {
    total: body.length,
    scope: config.discordGuildId ? 'guild' : 'global',
    guildId: config.discordGuildId ?? undefined,
  });

  return body.length;
}
