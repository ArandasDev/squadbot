import { EmbedBuilder } from 'discord.js';
import type { IdeaStatus, ItemRow, Priority, ProjectRow, TaskStatus } from '../types/index.js';

/** Paleta usada nos embeds — mantem a identidade visual consistente. */
export const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  neutral: 0x99aab5,
} as const;

export const PRIORITY_EMOJI: Record<Priority, string> = {
  urgent: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baixa',
};

/** Ordem de exibicao: da maior para a menor prioridade. */
export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const TASK_STATUS_EMOJI: Record<TaskStatus, string> = {
  pending: '🔴',
  in_progress: '🟡',
  done: '🟢',
  cancelled: '⚫',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluida',
  cancelled: 'Cancelada',
};

export const IDEA_STATUS_EMOJI: Record<IdeaStatus, string> = {
  new: '💡',
  considering: '🤔',
  accepted: '✅',
  rejected: '❌',
  implemented: '🚀',
};

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  new: 'Nova',
  considering: 'Em analise',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
  implemented: 'Implementada',
};

export const ITEM_TYPE_EMOJI = {
  task: '📋',
  note: '📝',
  idea: '💡',
  decision: '⚖️',
  link: '🔗',
} as const;

export const ITEM_TYPE_LABEL = {
  task: 'Tarefa',
  note: 'Nota',
  idea: 'Ideia',
  decision: 'Decisao',
  link: 'Link',
} as const;

/** Corta preservando o limite do Discord e sinalizando o corte. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

/** Neutraliza markdown para que titulos digitados pelo usuario nao quebrem o embed. */
export function escapeMarkdown(value: string): string {
  return value.replace(/([*_`~|\\>])/g, '\\$1');
}

export function mentionUser(discordId: string): string {
  return `<@${discordId}>`;
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS.success).setTitle(`✅ ${title}`);
  if (description) embed.setDescription(truncate(description, 4096));
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS.danger).setTitle(`❌ ${title}`);
  if (description) embed.setDescription(truncate(description, 4096));
  return embed;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS.primary).setTitle(title);
  if (description) embed.setDescription(truncate(description, 4096));
  return embed;
}

export function projectLabel(project: ProjectRow | null | undefined): string {
  if (!project) return 'Sem projeto';
  return project.status === 'archived' ? `${project.name} (arquivado)` : project.name;
}

/** Divide uma lista em paginas de tamanho fixo. */
export function paginate<T>(items: readonly T[], pageSize: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }
  return pages;
}

/** Linha compacta de item usada nas listagens. */
export function itemLine(item: ItemRow, projectName?: string | null): string {
  const prefix =
    item.type === 'task'
      ? (PRIORITY_EMOJI[(item.priority ?? 'medium') as Priority] ?? '⚪')
      : ITEM_TYPE_EMOJI[item.type];
  const project = projectName ? ` · \`${escapeMarkdown(projectName)}\`` : '';
  return `${prefix} \`#${item.id}\` ${escapeMarkdown(truncate(item.title, 80))}${project}`;
}
