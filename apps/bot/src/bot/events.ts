import {
  Events,
  MessageFlags,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Interaction,
} from 'discord.js';
import { commandRegistry } from './commands.js';
import type { AppContext } from '../services/index.js';
import { errorEmbed } from '../utils/formatting.js';
import { isAppError } from '../utils/errors.js';
import { isAdminInteraction } from '../utils/permissions.js';

const GENERIC_ERROR_TITLE = 'Nao foi possivel concluir o comando.';
const GENERIC_ERROR_BODY = 'Tente novamente ou contate um administrador.';

/** Responde ao usuario respeitando o estado atual da interacao. */
async function replyError(
  interaction: ChatInputCommandInteraction,
  title: string,
  description: string,
): Promise<void> {
  const payload = { embeds: [errorEmbed(title, description)], components: [] };

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
  } catch {
    // A interacao pode ter expirado; nao ha nada util a fazer aqui.
  }
}

async function handleChatInput(
  interaction: ChatInputCommandInteraction,
  context: AppContext,
): Promise<void> {
  const { logger, services } = context;
  const command = commandRegistry.get(interaction.commandName);

  if (!command) {
    logger.warn('Comando desconhecido', { command: interaction.commandName });
    await replyError(interaction, 'Comando desconhecido.', 'Use `/ajuda` para ver os comandos disponiveis.');
    return;
  }

  // O SquadBot organiza o trabalho de um servidor: fora de uma guild nao ha
  // `server_id` e, portanto, nao ha isolamento de dados possivel.
  if (!interaction.inGuild() || !interaction.guildId) {
    await replyError(
      interaction,
      'Este comando so funciona dentro de um servidor.',
      'Use o SquadBot em um canal do servidor do seu squad.',
    );
    return;
  }

  const serverId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand(false);
  const startedAt = Date.now();

  try {
    await interaction.deferReply(
      command.ephemeral ? { flags: MessageFlags.Ephemeral } : {},
    );

    const actor = services.users.ensure(serverId, {
      discordId: interaction.user.id,
      username: interaction.member?.user.username ?? interaction.user.username,
    });

    await command.execute({
      interaction,
      context,
      serverId,
      actor,
      isAdmin: isAdminInteraction(interaction),
    });

    logger.info('Comando executado', {
      command: interaction.commandName,
      subcommand: subcommand ?? undefined,
      guildId: serverId,
      userId: interaction.user.id,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    // Erros de dominio carregam mensagem segura; o resto vira mensagem generica.
    if (isAppError(error)) {
      logger.warn('Comando rejeitado', {
        command: interaction.commandName,
        subcommand: subcommand ?? undefined,
        guildId: serverId,
        userId: interaction.user.id,
        code: error.code,
        reason: error.message,
      });
      await replyError(interaction, 'Nao deu certo.', error.message);
      return;
    }

    logger.error('Erro de comando', {
      command: interaction.commandName,
      subcommand: subcommand ?? undefined,
      guildId: serverId,
      userId: interaction.user.id,
      durationMs: Date.now() - startedAt,
      error,
    });
    await replyError(interaction, GENERIC_ERROR_TITLE, GENERIC_ERROR_BODY);
  }
}

async function handleAutocomplete(
  interaction: AutocompleteInteraction,
  context: AppContext,
): Promise<void> {
  const command = commandRegistry.get(interaction.commandName);
  if (!command?.autocomplete || !interaction.guildId) {
    await interaction.respond([]).catch(() => undefined);
    return;
  }

  try {
    await command.autocomplete({ interaction, context, serverId: interaction.guildId });
  } catch (error) {
    context.logger.warn('Erro no autocomplete', {
      command: interaction.commandName,
      guildId: interaction.guildId,
      error,
    });
    await interaction.respond([]).catch(() => undefined);
  }
}

/** Liga os handlers de eventos do Discord ao contexto da aplicacao. */
export function registerEvents(client: Client, context: AppContext): void {
  const { logger } = context;

  client.once(Events.ClientReady, (readyClient) => {
    logger.info('Discord conectado', {
      user: readyClient.user.tag,
      guilds: readyClient.guilds.cache.size,
    });
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleChatInput(interaction, context);
      return;
    }
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction, context);
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    logger.info('Bot adicionado a um servidor', { guildId: guild.id, name: guild.name });
  });

  client.on(Events.Error, (error) => {
    logger.error('Erro no client do Discord', { error });
  });

  client.on(Events.Warn, (message) => {
    logger.warn('Aviso do client do Discord', { message });
  });
}
