import { SlashCommandBuilder } from 'discord.js';
import {
  projectOption,
  respondProjectAutocomplete,
  respondWithPages,
  resolveProjectOption,
  type AutocompleteInvocation,
  type CommandInvocation,
  type SlashCommand,
} from '../shared.js';
import { compactItemLine, itemDetailEmbed, itemListPages } from '../itemViews.js';
import {
  COLORS,
  IDEA_STATUS_EMOJI,
  IDEA_STATUS_LABEL,
  escapeMarkdown,
  successEmbed,
} from '../../utils/formatting.js';
import { ValidationError } from '../../utils/errors.js';
import { isIdeaStatus } from '../../services/IdeaService.js';
import type { IdeaStatus } from '../../types/index.js';

const STATUS_CHOICES = [
  { name: '💡 Nova', value: 'new' },
  { name: '🤔 Em analise', value: 'considering' },
  { name: '✅ Aceita', value: 'accepted' },
  { name: '❌ Rejeitada', value: 'rejected' },
  { name: '🚀 Implementada', value: 'implemented' },
] as const;

const data = new SlashCommandBuilder()
  .setName('ideia')
  .setDescription('Registra e acompanha as ideias do squad')
  .addSubcommand((sub) =>
    sub
      .setName('criar')
      .setDescription('Registra uma ideia')
      .addStringOption((option) =>
        option.setName('titulo').setDescription('A ideia em uma frase').setRequired(true).setMaxLength(200),
      )
      .addStringOption((option) =>
        option.setName('conteudo').setDescription('Detalhes da ideia').setMaxLength(4000),
      )
      .addStringOption((option) => projectOption(option)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('listar')
      .setDescription('Lista as ideias')
      .addStringOption((option) => projectOption(option))
      .addStringOption((option) =>
        option.setName('status').setDescription('Filtrar por status').addChoices(...STATUS_CHOICES),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('visualizar')
      .setDescription('Mostra uma ideia completa')
      .addIntegerOption((option) =>
        option.setName('ideia').setDescription('Ideia').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('implementar')
      .setDescription('Marca a ideia como implementada')
      .addIntegerOption((option) =>
        option.setName('ideia').setDescription('Ideia').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('rejeitar')
      .setDescription('Marca a ideia como rejeitada')
      .addIntegerOption((option) =>
        option.setName('ideia').setDescription('Ideia').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('status')
      .setDescription('Atualiza o status da ideia')
      .addIntegerOption((option) =>
        option.setName('ideia').setDescription('Ideia').setRequired(true).setAutocomplete(true),
      )
      .addStringOption((option) =>
        option.setName('novo').setDescription('Novo status').setRequired(true).addChoices(...STATUS_CHOICES),
      ),
  );

async function applyStatus(invocation: CommandInvocation, status: IdeaStatus): Promise<void> {
  const { interaction, context, serverId, actor, isAdmin } = invocation;
  const idea = context.services.ideas.setStatus(
    serverId,
    interaction.options.getInteger('ideia', true),
    status,
    actor,
    isAdmin,
  );

  await interaction.editReply({
    embeds: [
      successEmbed(
        `Ideia ${IDEA_STATUS_LABEL[status].toLowerCase()}`,
        `${IDEA_STATUS_EMOJI[status]} \`#${idea.id}\` ${escapeMarkdown(idea.title)}`,
      ),
    ],
  });
}

export const ideaCommand: SlashCommand = {
  data,
  async execute(invocation: CommandInvocation) {
    const { interaction, context, serverId, actor } = invocation;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'criar') {
      const idea = context.services.ideas.create({
        serverId,
        actor,
        title: interaction.options.getString('titulo', true),
        content: interaction.options.getString('conteudo'),
        projectId: resolveProjectOption(invocation) ?? null,
      });

      await interaction.editReply({
        embeds: [
          successEmbed('Ideia registrada', `💡 \`#${idea.id}\` **${escapeMarkdown(idea.title)}**`),
        ],
      });
      return;
    }

    if (subcommand === 'listar') {
      const statusRaw = interaction.options.getString('status');
      if (statusRaw !== null && !isIdeaStatus(statusRaw)) {
        throw new ValidationError('Status invalido.');
      }
      const status: IdeaStatus | null = statusRaw;

      const projectId = resolveProjectOption(invocation);
      const ideas = status
        ? context.services.ideas.listByStatus(serverId, status)
        : context.services.ideas.list(serverId, projectId);

      // Ao filtrar por status, o recorte por projeto é aplicado em memoria.
      const filtered =
        status && projectId !== undefined
          ? ideas.filter((idea) => idea.project_id === projectId)
          : ideas;

      await respondWithPages(
        interaction,
        itemListPages(filtered, {
          title: '💡 Ideias',
          emptyMessage: 'Nenhuma ideia por aqui. Registre a primeira com `/ideia criar`.',
          color: COLORS.warning,
          render: (item) => compactItemLine(item, IDEA_STATUS_EMOJI[item.status as IdeaStatus] ?? '💡'),
        }),
      );
      return;
    }

    if (subcommand === 'visualizar') {
      const idea = context.services.ideas.detail(serverId, interaction.options.getInteger('ideia', true));
      const status = idea.status as IdeaStatus;
      await interaction.editReply({
        embeds: [
          itemDetailEmbed(idea, {
            title: IDEA_STATUS_EMOJI[status] ?? '💡',
            color: COLORS.warning,
            timezone: actor.timezone,
            fields: [
              {
                name: 'Status',
                value: `${IDEA_STATUS_EMOJI[status] ?? '💡'} ${IDEA_STATUS_LABEL[status] ?? status}`,
                inline: true,
              },
            ],
          }),
        ],
      });
      return;
    }

    if (subcommand === 'implementar') return applyStatus(invocation, 'implemented');
    if (subcommand === 'rejeitar') return applyStatus(invocation, 'rejected');

    if (subcommand === 'status') {
      const novo = interaction.options.getString('novo', true);
      if (!isIdeaStatus(novo)) throw new ValidationError('Status invalido.');
      return applyStatus(invocation, novo);
    }

    throw new ValidationError(`Subcomando desconhecido: ${subcommand}`);
  },
  async autocomplete(invocation: AutocompleteInvocation) {
    const focused = invocation.interaction.options.getFocused(true);

    if (focused.name === 'projeto') {
      await respondProjectAutocomplete(invocation);
      return;
    }

    const choices = invocation.context.services.ideas.autocomplete(
      invocation.serverId,
      focused.value.toString(),
    );
    await invocation.interaction.respond(choices.slice(0, 25));
  },
};

export default ideaCommand;
