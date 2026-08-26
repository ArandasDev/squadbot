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
  .setName('nota')
  .setDescription('Guarda o conhecimento do squad')
  .addSubcommand((sub) =>
    sub
      .setName('criar')
      .setDescription('Cria uma anotacao')
      .addStringOption((option) =>
        option.setName('titulo').setDescription('Titulo da nota').setRequired(true).setMaxLength(200),
      )
      .addStringOption((option) =>
        option
          .setName('conteudo')
          .setDescription('O que precisa ser lembrado')
          .setRequired(true)
          .setMaxLength(4000),
      )
      .addStringOption((option) => projectOption(option)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('listar')
      .setDescription('Lista as anotacoes')
      .addStringOption((option) => projectOption(option)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('visualizar')
      .setDescription('Mostra uma anotacao completa')
      .addIntegerOption((option) =>
        option.setName('nota').setDescription('Nota').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('excluir')
      .setDescription('Exclui uma anotacao')
      .addIntegerOption((option) =>
        option.setName('nota').setDescription('Nota').setRequired(true).setAutocomplete(true),
      ),
  );

export const noteCommand: SlashCommand = {
  data,
  async execute(invocation: CommandInvocation) {
    const { interaction, context, serverId, actor, isAdmin } = invocation;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'criar') {
      const note = context.services.notes.create({
        serverId,
        actor,
        title: interaction.options.getString('titulo', true),
        content: interaction.options.getString('conteudo', true),
        projectId: resolveProjectOption(invocation) ?? null,
      });

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Nota criada',
            `📝 \`#${note.id}\` **${escapeMarkdown(note.title)}**\n\n${truncate(escapeMarkdown(note.content ?? ''), 500)}`,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'listar') {
      const projectId = resolveProjectOption(invocation);
      const notes = context.services.notes.list(serverId, projectId);
      await respondWithPages(
        interaction,
        itemListPages(notes, {
          title: '📝 Anotacoes',
          emptyMessage: 'Nenhuma anotacao ainda. Guarde a primeira com `/nota criar`.',
          render: (item) => compactItemLine(item, '📝'),
        }),
      );
      return;
    }

    if (subcommand === 'visualizar') {
      const note = context.services.notes.detail(serverId, interaction.options.getInteger('nota', true));
      await interaction.editReply({
        embeds: [itemDetailEmbed(note, { title: '📝', timezone: actor.timezone })],
      });
      return;
    }

    if (subcommand === 'excluir') {
      const note = context.services.notes.remove(
        serverId,
        interaction.options.getInteger('nota', true),
        actor,
        isAdmin,
      );
      await interaction.editReply({
        embeds: [successEmbed('Nota excluida', `🗑️ \`#${note.id}\` ${escapeMarkdown(note.title)}`)],
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

    const choices = invocation.context.services.notes.autocomplete(
      invocation.serverId,
      focused.value.toString(),
    );
    await invocation.interaction.respond(choices.slice(0, 25));
  },
};

export default noteCommand;
