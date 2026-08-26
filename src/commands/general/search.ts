import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respondWithPages, type SlashCommand } from '../shared.js';
import {
  COLORS,
  ITEM_TYPE_EMOJI,
  ITEM_TYPE_LABEL,
  escapeMarkdown,
  paginate,
  truncate,
} from '../../utils/formatting.js';
import type { ItemType } from '../../types/index.js';
import type { ItemWithProject } from '../../database/repositories/index.js';

const PAGE_SIZE = 10;

const data = new SlashCommandBuilder()
  .setName('buscar')
  .setDescription('Procura em tarefas, notas, ideias, decisoes e links deste servidor')
  .addStringOption((option) =>
    option
      .setName('termo')
      .setDescription('O que voce esta procurando')
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(100),
  )
  .addStringOption((option) =>
    option
      .setName('tipo')
      .setDescription('Restringir a um tipo de registro')
      .addChoices(
        { name: '📋 Tarefas', value: 'task' },
        { name: '📝 Notas', value: 'note' },
        { name: '💡 Ideias', value: 'idea' },
        { name: '⚖️ Decisoes', value: 'decision' },
        { name: '🔗 Links', value: 'link' },
      ),
  );

function resultLine(item: ItemWithProject): string {
  const emoji = ITEM_TYPE_EMOJI[item.type];
  const label = ITEM_TYPE_LABEL[item.type];
  const project = item.project_name ? ` · \`${escapeMarkdown(item.project_name)}\`` : '';
  const snippet = item.content
    ? `\n ↳ ${escapeMarkdown(truncate(item.content.replace(/\s+/g, ' '), 100))}`
    : '';
  return `${emoji} **${escapeMarkdown(truncate(item.title, 70))}** \`#${item.id}\` · ${label}${project}${snippet}`;
}

export const searchCommand: SlashCommand = {
  data,
  ephemeral: true,
  async execute({ interaction, context, serverId }) {
    const term = interaction.options.getString('termo', true);
    const type = interaction.options.getString('tipo') as ItemType | null;

    const result = context.services.search.search(serverId, term, type ? [type] : undefined);

    if (result.total === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.neutral)
            .setTitle(`🔍 Busca: ${truncate(result.term, 60)}`)
            .setDescription('Nada encontrado neste servidor.'),
        ],
      });
      return;
    }

    const pages = paginate(result.all, PAGE_SIZE).map((chunk, pageIndex, all) =>
      new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle(`🔍 Busca: ${truncate(result.term, 60)}`)
        .setDescription(chunk.map(resultLine).join('\n'))
        .setFooter({
          text: `Pagina ${pageIndex + 1}/${all.length} · ${result.total} resultado(s)`,
        }),
    );

    await respondWithPages(interaction, pages);
  },
};

export default searchCommand;
