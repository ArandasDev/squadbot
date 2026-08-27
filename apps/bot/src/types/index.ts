/**
 * Tipos compartilhados do SquadBot.
 *
 * Convencao de datas: TUDO que é persistido no SQLite fica em UTC, no formato
 * ISO 8601 (`2026-08-28T12:00:00.000Z`). A conversao para o timezone do usuario
 * acontece apenas na camada de apresentacao/interpretacao (`utils/dates.ts`).
 */

export type ItemType = 'task' | 'note' | 'idea' | 'decision' | 'link';

export const ITEM_TYPES: readonly ItemType[] = ['task', 'note', 'idea', 'decision', 'link'];

export type ProjectStatus = 'active' | 'archived';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high', 'urgent'];

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'done', 'cancelled'];

export type IdeaStatus = 'new' | 'considering' | 'accepted' | 'rejected' | 'implemented';

export const IDEA_STATUSES: readonly IdeaStatus[] = [
  'new',
  'considering',
  'accepted',
  'rejected',
  'implemented',
];

/** Status usado por notas, decisoes e links (itens sem ciclo de vida proprio). */
export type SimpleStatus = 'active' | 'archived';

export interface UserRow {
  id: number;
  discord_id: string;
  server_id: string;
  username: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: number;
  server_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectMemberRow {
  project_id: number;
  user_id: number;
  joined_at: string;
}

export interface ItemRow {
  id: number;
  server_id: string;
  project_id: number | null;
  created_by: number;
  assigned_to: number | null;
  type: ItemType;
  title: string;
  content: string | null;
  status: string;
  priority: Priority | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderRow {
  id: number;
  server_id: string;
  created_by: number;
  recipient_id: number;
  item_id: number | null;
  message: string;
  remind_at: string;
  sent: number;
  created_at: string;
  sent_at: string | null;
}

/** Entrada de criacao de item, ja normalizada pelos services. */
export interface CreateItemInput {
  serverId: string;
  projectId: number | null;
  createdBy: number;
  assignedTo?: number | null;
  type: ItemType;
  title: string;
  content?: string | null;
  status: string;
  priority?: Priority | null;
  dueAt?: string | null;
}

export interface ListItemsFilter {
  serverId: string;
  type?: ItemType;
  projectId?: number | null;
  assignedTo?: number;
  createdBy?: number;
  status?: string | string[];
  notStatus?: string | string[];
  limit?: number;
  offset?: number;
}

export interface CreateReminderInput {
  serverId: string;
  createdBy: number;
  recipientId: number;
  itemId?: number | null;
  message: string;
  remindAt: string;
}
