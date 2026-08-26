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
import { itemListPages } from '../itemViews.js';
import { escapeMarkdown, successEmbed, truncate } from '../../utils/formatting.js';
import { ValidationError } from '../../utils/errors.js';

const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Guarda os links importantes do squad')
  .addSubcommand((sub) =>
    sub
      .setName('criar')
      .setDescription('Guarda um link')
      .addStringOption((option) =>
        option
          .setName('nome')
          .setDescription('Como o link sera identificado')
          .setRequired(true)
          .setMaxLength(200),
      )
      .addStringOption((option) =>
        option
          .setName('url')
          .setDescription('Endereco completo (https://...)')
          .setRequired(true)
          .setMaxLength(2000),
      )
      .addStringOption((option) => projectOption(option)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('listar')
      .setDescription('Lista os links guardados')
      .addStringOption((option) => projectOption(option)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('excluir')
      .setDescription('Exclui um link')
      .addIntegerOption((option) =>
        option.setName('link').setDescription('Link').setRequired(true).setAutocomplete(true),
      ),
  );

export const linkCommand: SlashCommand = {
  data,
  async execute(invocation: CommandInvocation) {
    const { interaction, context, serverId, actor, isAdmin } = invocation;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'criar') {
      const link = context.services.links.createLink({
        serverId,
        actor,
        name: interaction.options.getString('nome', true),
        url: interaction.options.getString('url', true),
        projectId: resolveProjectOption(invocation) ?? null,
      });

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Link guardado',
            `🔗 \`#${link.id}\` [${escapeMarkdown(link.title)}](${link.content})`,
          ),
        ],
      });
      return;
    }

    if (subcommand === 'listar') {
      const projectId = resolveProjectOption(invocation);
      const links = context.services.links.list(serverId, projectId);

      await respondWithPages(
        interaction,
        itemListPages(links, {
          title: '🔗 Links',
          emptyMessage: 'Nenhum link guardado. Use `/link criar`.',
          render: (item) => {
            const project = item.project_name ? ` · \`${escapeMarkdown(item.project_name)}\`` : '';
            const label = escapeMarkdown(truncate(item.title, 70));
            return item.content
              ? `🔗 \`#${item.id}\` [${label}](${item.content})${project}`
              : `🔗 \`#${item.id}\` ${label}${project}`;
          },
        }),
      );
      return;
    }

    if (subcommand === 'excluir') {
      const link = context.services.links.remove(
        serverId,
        interaction.options.getInteger('link', true),
        actor,
        isAdmin,
      );
      await interaction.editReply({
        embeds: [successEmbed('Link excluido', `🗑️ \`#${link.id}\` ${escapeMarkdown(link.title)}`)],
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

    const choices = invocation.context.services.links.autocomplete(
      invocation.serverId,
      focused.value.toString(),
    );
    await invocation.interaction.respond(choices.slice(0, 25));
  },
};

export default linkCommand;
