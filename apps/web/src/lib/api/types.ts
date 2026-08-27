/**
 * Espelho do contrato publico da API do bot (`apps/bot/src/api/dto.ts`).
 *
 * A duplicacao é intencional: a fronteira entre os dois apps é o HTTP, nao um
 * import. Se um campo mudar la, o build daqui aponta o ajuste.
 *
 * Datas chegam sempre em UTC ISO 8601 e sao formatadas no fuso do usuario.
 */

export type ItemType = 'task' | 'note' | 'idea' | 'decision' | 'link';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type IdeaStatus = 'new' | 'considering' | 'accepted' | 'rejected' | 'implemented';
export type ProjectStatus = 'active' | 'archived';

export interface UserDTO {
  id: number;
  discordId: string;
  username: string;
  timezone: string;
}

export interface TaskCountsDTO {
  pending: number;
  in_progress: number;
  done: number;
  cancelled: number;
}

export interface ProjectDTO {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithCountsDTO extends ProjectDTO {
  taskCounts: TaskCountsDTO;
}

export interface ProjectDetailDTO extends ProjectDTO {
  members: UserDTO[];
  taskCounts: TaskCountsDTO;
}

export interface ItemDTO {
  id: number;
  type: ItemType;
  title: string;
  content: string | null;
  status: string;
  priority: Priority | null;
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
