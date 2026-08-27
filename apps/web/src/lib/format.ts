import type { IdeaStatus, ItemType, Priority, TaskStatus } from './api/types';

/**
 * Rotulos e formatacao de datas do dashboard.
 *
 * Regra herdada do bot: o banco guarda UTC, a interface exibe no fuso do
 * usuario. Por isso toda funcao daqui recebe o `timezone` explicitamente —
 * nunca usa o fuso do servidor que renderizou a pagina.
 */

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Classes de cor por prioridade — os mesmos semáforos usados nos embeds. */
export const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
};

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  new: 'Nova',
  considering: 'Em análise',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
  implemented: 'Implementada',
};

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  task: 'Tarefa',
  note: 'Nota',
  idea: 'Ideia',
  decision: 'Decisão',
  link: 'Link',
};

export const ITEM_TYPE_PLURAL: Record<ItemType, string> = {
  task: 'Tarefas',
  note: 'Notas',
  idea: 'Ideias',
  decision: 'Decisões',
  link: 'Links',
};

export function isTaskStatus(value: string): value is TaskStatus {
  return ['pending', 'in_progress', 'done', 'cancelled'].includes(value);
}

export function isIdeaStatus(value: string): value is IdeaStatus {
  return ['new', 'considering', 'accepted', 'rejected', 'implemented'].includes(value);
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hourCycle: 'h23',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

function zonedDayNumber(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [year, month, day] = parts.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** `Hoje 18:00`, `Amanhã 09:00`, `28/08 14:30`. */
export function formatRelative(iso: string, timeZone: string, now = new Date()): string {
  const date = new Date(iso);
  const diffDays = Math.round(
    (zonedDayNumber(date, timeZone) - zonedDayNumber(now, timeZone)) / 86_400_000,
  );

  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  if (diffDays === 0) return `Hoje ${time}`;
  if (diffDays === 1) return `Amanhã ${time}`;
  if (diffDays === -1) return `Ontem ${time}`;

  const datePart = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(date);
  return `${datePart} ${time}`;
}

/** `true` quando o prazo ja passou — usado para destacar atrasos. */
export function isOverdue(iso: string | null, now = new Date()): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < now.getTime();
}

export function sortByPriority<T extends { priority: Priority | null }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => PRIORITY_ORDER[a.priority ?? 'medium'] - PRIORITY_ORDER[b.priority ?? 'medium'],
  );
}
