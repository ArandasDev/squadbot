import { EmbedBuilder } from 'discord.js';
import type { ItemWithProject } from '../database/repositories/index.js';
import { COLORS, escapeMarkdown, mentionUser, paginate, truncate } from '../utils/formatting.js';
import { formatDateTime } from '../utils/dates.js';

const PAGE_SIZE = 8;

export interface ItemListOptions {
  title: string;
  emptyMessage: string;
  color?: number;
  render: (item: ItemWithProject) => string;
  pageSize?: number;
}

/** Renderiza uma lista de itens em paginas de embed prontas para `respondWithPages`. */
export function itemListPages(items: ItemWithProject[], options: ItemListOptions): EmbedBuilder[] {
  if (items.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(COLORS.neutral)
        .setTitle(options.title)
        .setDescription(options.emptyMessage),
    ];
  }

  return paginate(items, options.pageSize ?? PAGE_SIZE).map((chunk, pageIndex, all) =>
    new EmbedBuilder()
      .setColor(options.color ?? COLORS.primary)
      .setTitle(options.title)
      .setDescription(chunk.map(options.render).join('\n'))
      .setFooter({ text: `Pagina ${pageIndex + 1}/${all.length} · ${items.length} registro(s)` }),
  );
}

export interface ItemDetailOptions {
  title: string;
  color?: number;
  timezone: string;
  /** Campos extras exibidos antes do rodape (ex.: status de uma ideia). */
  fields?: { name: string; value: string; inline?: boolean }[];
}

/** Embed de detalhe de um item (nota, ideia, decisao, link). */
export function itemDetailEmbed(item: ItemWithProject, options: ItemDetailOptions): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(options.color ?? COLORS.primary)
    .setTitle(truncate(`${options.title} ${escapeMarkdown(item.title)}`, 256))
    .setDescription(item.content ? truncate(escapeMarkdown(item.content), 4000) : '_Sem conteudo_');

  const meta: { name: string; value: string; inline?: boolean }[] = [
    {
      name: 'Projeto',
      value: item.project_name ? escapeMarkdown(item.project_name) : '_Sem projeto_',
      inline: true,
    },
    { name: 'Criado por', value: mentionUser(item.creator_discord_id), inline: true },
  ];

  embed.addFields(...meta, ...(options.fields ?? []));
  embed.setFooter({
    text: `#${item.id} · ${formatDateTime(new Date(item.created_at), options.timezone)}`,
  });

  return embed;
}

/** Linha curta e uniforme usada nas listagens de itens. */
export function compactItemLine(item: ItemWithProject, emoji: string): string {
  const project = item.project_name ? ` · \`${escapeMarkdown(item.project_name)}\`` : '';
  return `${emoji} \`#${item.id}\` **${escapeMarkdown(truncate(item.title, 70))}**${project}`;
}
