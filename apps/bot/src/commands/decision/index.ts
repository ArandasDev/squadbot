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
import { escapeMarkdown, successEmbed, truncate } from '../../utils/formatting.js';
import { ValidationError } from '../../utils/errors.js';

const data = new SlashCommandBuilder()
  .setName('decisao')
  .setDescription('Memoria historica das decisoes do squad')
  .addSubcommand((sub) =>
    sub
      .setName('criar')
      .setDescription('Registra uma decisao tomada')
      .addStringOption((option) =>
        option.setName('titulo').setDescription('O que foi decidido').setRequired(true).setMaxLength(200),
      )
      .addStringOption((option) =>
        option
          .setName('conteudo')
          .setDescription('A decisao e o motivo dela')
          .setRequired(true)
          .setMaxLength(4000),
      )
      .addStringOption((option) => projectOption(option)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('listar')
      .setDescription('Lista as decisoes registradas')
      .addStringOption((option) => projectOption(option)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('visualizar')
      .setDescription('Mostra uma decisao completa')
      .addIntegerOption((option) =>
        option.setName('decisao').setDescription('Decisao').setRequired(true).setAutocomplete(true),
      ),
  );

export const decisionCommand: SlashCommand = {
  data,
  async execute(invocation: CommandInvocation) {
    const { interaction, context, serverId, actor } = invocation;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'criar') {
      const decision = context.services.decisions.create({
        serverId,
        actor,
        title: interaction.options.getString('titulo', true),
        content: interaction.options.getString('conteudo', true),
        projectId: resolveProjectOption(invocation) ?? null,
      });

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Decisao registrada',
            `⚖️ \`#${decision.id}\` **${escapeMarkdown(decision.title)}**\n\n${truncate(escapeMarkdown(decision.content ?? ''), 500)}`,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'listar') {
      const projectId = resolveProjectOption(invocation);
      const decisions = context.services.decisions.list(serverId, projectId);
      await respondWithPages(
        interaction,
        itemListPages(decisions, {
          title: '⚖️ Decisoes',
          emptyMessage: 'Nenhuma decisao registrada. Use `/decisao criar` depois da proxima call.',
          render: (item) => compactItemLine(item, '⚖️'),
        }),
      );
      return;
    }

    if (subcommand === 'visualizar') {
      const decision = context.services.decisions.detail(
        serverId,
        interaction.options.getInteger('decisao', true),
      );
      await interaction.editReply({
        embeds: [itemDetailEmbed(decision, { title: '⚖️', timezone: actor.timezone })],
      });
      return;
    }

    throw new ValidationError(`Subcomando desconhecido: ${subcommand}`);
  },
  async autocomplete(invocation: AutocompleteInvocation) {
    const focused = invocation.interaction.options.getFocused(true);

    if (focused.name === 'projeto') {
      await respondProjectAutocomplete(invocation);
      return;
    }

    const choices = invocation.context.services.decisions.autocomplete(
      invocation.serverId,
      focused.value.toString(),
    );
    await invocation.interaction.respond(choices.slice(0, 25));
  },
};

export default decisionCommand;
