import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption,
  type SlashCommandUserOption,
  type User,
} from 'discord.js';
import type { AppContext } from '../services/index.js';
import type { UserRow } from '../types/index.js';
import { ValidationError } from '../utils/errors.js';

/** Tudo que um comando precisa: ja resolvido e validado pelo handler de eventos. */
export interface CommandInvocation {
  interaction: ChatInputCommandInteraction;
  context: AppContext;
  /** Servidor onde o comando foi executado — usado para isolar TODOS os dados. */
  serverId: string;
  /** Linha `users` de quem executou o comando. */
  actor: UserRow;
  isAdmin: boolean;
}

export interface AutocompleteInvocation {
  interaction: AutocompleteInteraction;
  context: AppContext;
  serverId: string;
}

export interface SlashCommand {
  /** JSON do slash command, pronto para registro na API do Discord. */
  data: { name: string; toJSON: () => unknown };
  /** Quando `true`, a resposta so é visivel para quem executou o comando. */
  ephemeral?: boolean;
  execute: (invocation: CommandInvocation) => Promise<void>;
  autocomplete?: (invocation: AutocompleteInvocation) => Promise<void>;
}

/** Opcao padrao de projeto (usa autocomplete e envia o id do projeto como valor). */
export function projectOption(option: SlashCommandStringOption, required = false): SlashCommandStringOption {
  return option
    .setName('projeto')
    .setDescription('Projeto relacionado')
    .setAutocomplete(true)
    .setRequired(required);
}

export function userOption(
  option: SlashCommandUserOption,
  name: string,
  description: string,
  required = false,
): SlashCommandUserOption {
  return option.setName(name).setDescription(description).setRequired(required);
}

/**
 * Converte o valor da opcao `projeto` (id vindo do autocomplete, ou nome digitado)
 * no id numerico do projeto. Retorna `undefined` quando a opcao nao foi informada.
 */
export function resolveProjectOption(
  invocation: CommandInvocation,
  optionName = 'projeto',
): number | null | undefined {
  const raw = invocation.interaction.options.getString(optionName);
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === '-' || trimmed.toLowerCase() === 'nenhum') return null;
  return invocation.context.services.projects.require(invocation.serverId, trimmed).id;
}

/**
 * Garante que o usuario informado pertence ao servidor e devolve a linha `users`
 * correspondente. É esta checagem que impede lembretes para gente de fora.
 */
export async function resolveGuildUser(
  invocation: CommandInvocation,
  discordUser: User,
): Promise<UserRow> {
  const { interaction, context, serverId } = invocation;

  if (discordUser.bot) {
    throw new ValidationError('Bots nao podem ser responsaveis nem receber lembretes.');
  }

  const member = await interaction.guild?.members.fetch(discordUser.id).catch(() => null);
  if (!member) {
    throw new ValidationError(
      `**${discordUser.username}** nao é membro deste servidor. So é possivel usar membros do servidor.`,
    );
  }

  return context.services.users.ensure(serverId, {
    discordId: member.id,
    username: member.displayName,
  });
}

/** Resolve a opcao de usuario, ou devolve `null` quando ela nao foi informada. */
export async function resolveOptionalGuildUser(
  invocation: CommandInvocation,
  optionName: string,
): Promise<UserRow | null> {
  const discordUser = invocation.interaction.options.getUser(optionName);
  if (!discordUser) return null;
  return resolveGuildUser(invocation, discordUser);
}

/** Autocomplete de projetos, reutilizado por praticamente todos os comandos. */
export async function respondProjectAutocomplete(
  invocation: AutocompleteInvocation,
  onlyActive = true,
): Promise<void> {
  const term = invocation.interaction.options.getFocused().toString();
  const choices = invocation.context.services.projects.autocomplete(
    invocation.serverId,
    term,
    onlyActive,
  );
  await invocation.interaction.respond(choices.slice(0, 25));
}

const PAGE_TIMEOUT_MS = 300_000;

/**
 * Responde com uma lista paginada. Com uma unica pagina, envia direto; com
 * varias, adiciona botoes de navegacao validos apenas para quem chamou o comando.
 */
export async function respondWithPages(
  interaction: ChatInputCommandInteraction,
  pages: EmbedBuilder[],
): Promise<void> {
  const safePages = pages.length > 0 ? pages : [new EmbedBuilder().setDescription('Nada por aqui.')];

  if (safePages.length === 1) {
    await interaction.editReply({ embeds: [safePages[0] as EmbedBuilder], components: [] });
    return;
  }

  let index = 0;
  const buildRow = (disabled: boolean): ActionRowBuilder<ButtonBuilder> =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('squadbot:page:prev')
        .setLabel('Anterior')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || index === 0),
      new ButtonBuilder()
        .setCustomId('squadbot:page:indicator')
        .setLabel(`${index + 1}/${safePages.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('squadbot:page:next')
        .setLabel('Proxima')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || index === safePages.length - 1),
    );

  const message = await interaction.editReply({
    embeds: [safePages[0] as EmbedBuilder],
    components: [buildRow(false)],
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: PAGE_TIMEOUT_MS,
  });

  collector.on('collect', async (button) => {
    if (button.user.id !== interaction.user.id) {
      await button.reply({
        content: 'Apenas quem executou o comando pode navegar por esta lista.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (button.customId === 'squadbot:page:prev') index = Math.max(0, index - 1);
    if (button.customId === 'squadbot:page:next') index = Math.min(safePages.length - 1, index + 1);

    await button.update({
      embeds: [safePages[index] as EmbedBuilder],
      components: [buildRow(false)],
    });
  });

  collector.on('end', async () => {
    // Desabilita os botoes ao expirar; a mensagem pode ja ter sido apagada.
    await interaction.editReply({ components: [buildRow(true)] }).catch(() => undefined);
  });
}
