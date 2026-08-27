import type { ItemWithProject, ReminderWithTargets } from '../database/repositories/index.js';
import type { ItemRow, ProjectRow, ReminderRow, UserRow } from '../types/index.js';

/**
 * Contrato publico da API REST.
 *
 * As linhas do banco usam snake_case e ids internos; o que sai pela API é
 * camelCase e estavel. Esta camada existe justamente para que uma mudanca de
 * schema nao vire uma quebra no dashboard.
 *
 * Datas sempre em UTC ISO 8601 — quem exibe converte para o fuso do usuario.
 */

export interface UserDTO {
  id: number;
  discordId: string;
  username: string;
  timezone: string;
}

export interface ProjectDTO {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailDTO extends ProjectDTO {
  members: UserDTO[];
  taskCounts: TaskCountsDTO;
}

export interface TaskCountsDTO {
  pending: number;
  in_progress: number;
  done: number;
  cancelled: number;
}

export interface ItemDTO {
  id: number;
  type: 'task' | 'note' | 'idea' | 'decision' | 'link';
  title: string;
  content: string | null;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: number; name: string } | null;
  createdBy: { id: number; discordId: string };
  assignedTo: { id: number; discordId: string } | null;
}

export interface ReminderDTO {
  id: number;
  message: string;
  remindAt: string;
  sent: boolean;
  sentAt: string | null;
  createdAt: string;
  createdBy: UserDTO;
  recipient: UserDTO;
  itemTitle: string | null;
}

export interface GuildDTO {
  id: string;
  name: string;
  iconUrl: string | null;
}

export interface MeDTO {
  user: UserDTO;
  isAdmin: boolean;
  guild: GuildDTO;
  serverTimezone: string;
}

export interface OverviewDTO {
  tasks: {
    urgent: ItemDTO[];
    high: ItemDTO[];
    inProgress: ItemDTO[];
    others: ItemDTO[];
    total: number;
  };
  reminders: ReminderDTO[];
  ideas: ItemDTO[];
}

export interface SummaryProjectDTO {
  project: ProjectDTO | null;
  taskCounts: TaskCountsDTO;
}

export interface SummaryDTO {
  projects: SummaryProjectDTO[];
  unassigned: SummaryProjectDTO | null;
  pendingReminders: number;
  upcomingReminders: ReminderDTO[];
  newIdeas: number;
}

export interface SearchResultDTO {
  term: string;
  total: number;
  results: ItemDTO[];
}

export interface ApiErrorDTO {
  error: { code: string; message: string };
}

const EMPTY_COUNTS: TaskCountsDTO = { pending: 0, in_progress: 0, done: 0, cancelled: 0 };

export function toTaskCounts(counts: Record<string, number>): TaskCountsDTO {
  return {
    pending: counts.pending ?? 0,
    in_progress: counts.in_progress ?? 0,
    done: counts.done ?? 0,
    cancelled: counts.cancelled ?? 0,
  };
}

export function emptyTaskCounts(): TaskCountsDTO {
  return { ...EMPTY_COUNTS };
}

export function toUserDTO(user: UserRow): UserDTO {
  return {
    id: user.id,
    discordId: user.discord_id,
    username: user.username,
    timezone: user.timezone,
  };
}

export function toProjectDTO(project: ProjectRow): ProjectDTO {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

/**
 * Aceita tanto `ItemRow` quanto `ItemWithProject`. Quando os joins nao vieram,
 * os campos derivados sao preenchidos com o que da para inferir da propria linha.
 */
export function toItemDTO(item: ItemRow | ItemWithProject): ItemDTO {
  const joined = item as Partial<ItemWithProject>;

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    content: item.content,
    status: item.status,
    priority: item.priority,
    dueAt: item.due_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    project:
      item.project_id !== null
        ? { id: item.project_id, name: joined.project_name ?? '' }
        : null,
    createdBy: { id: item.created_by, discordId: joined.creator_discord_id ?? '' },
    assignedTo:
      item.assigned_to !== null
        ? { id: item.assigned_to, discordId: joined.assignee_discord_id ?? '' }
        : null,
  };
}

export function toReminderDTO(reminder: ReminderWithTargets): ReminderDTO {
  return {
    id: reminder.id,
    message: reminder.message,
    remindAt: reminder.remind_at,
    sent: reminder.sent === 1,
    sentAt: reminder.sent_at,
    createdAt: reminder.created_at,
    createdBy: {
      id: reminder.created_by,
      discordId: reminder.creator_discord_id,
      username: reminder.creator_username,
      timezone: reminder.creator_timezone,
    },
    recipient: {
      id: reminder.recipient_id,
      discordId: reminder.recipient_discord_id,
      username: reminder.recipient_username,
      timezone: reminder.recipient_timezone,
    },
    itemTitle: reminder.item_title,
  };
}

export function toBasicReminderDTO(reminder: ReminderRow, creator: UserRow, recipient: UserRow): ReminderDTO {
  return {
    id: reminder.id,
    message: reminder.message,
    remindAt: reminder.remind_at,
    sent: reminder.sent === 1,
    sentAt: reminder.sent_at,
    createdAt: reminder.created_at,
    createdBy: toUserDTO(creator),
    recipient: toUserDTO(recipient),
    itemTitle: null,
  };
}
