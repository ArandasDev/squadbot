import type { Repositories, ItemWithProject } from '../database/repositories/index.js';
import type { ItemRow, Priority, TaskStatus, UserRow } from '../types/index.js';
import { PRIORITIES, TASK_STATUSES } from '../types/index.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { assertCanManageItem } from '../utils/permissions.js';

export const TITLE_MAX = 200;
export const CONTENT_MAX = 2000;

export interface CreateTaskInput {
  serverId: string;
  actor: UserRow;
  title: string;
  projectId?: number | null;
  description?: string | null;
  assignedTo?: UserRow | null;
  priority?: Priority;
  dueAt?: Date | null;
}

export interface ListTasksInput {
  serverId: string;
  projectId?: number | null;
  assignedTo?: number;
  status?: TaskStatus | TaskStatus[];
  includeClosed?: boolean;
  limit?: number;
}

export interface EditTaskInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  dueAt?: Date | null;
  clearDueAt?: boolean;
  assignedTo?: UserRow | null;
  projectId?: number | null;
}

const CLOSED_STATUSES: TaskStatus[] = ['done', 'cancelled'];

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

/**
 * Regras de negocio das tarefas. Os comandos apenas coletam as opcoes do Discord
 * e delegam para ca — validacao, permissao e persistencia vivem neste nivel.
 */
export class TaskService {
  constructor(private readonly repos: Repositories) {}

  create(input: CreateTaskInput): ItemRow {
    const title = input.title.trim();
    if (title.length < 2) throw new ValidationError('O titulo da tarefa precisa ter pelo menos 2 caracteres.');
    if (title.length > TITLE_MAX) {
      throw new ValidationError(`O titulo deve ter no maximo ${TITLE_MAX} caracteres.`);
    }
    if (input.description && input.description.length > CONTENT_MAX) {
      throw new ValidationError(`A descricao deve ter no maximo ${CONTENT_MAX} caracteres.`);
    }
    if (input.dueAt && Number.isNaN(input.dueAt.getTime())) {
      throw new ValidationError('Prazo invalido.');
    }

    const projectId = this.normalizeProjectId(input.serverId, input.projectId);

    return this.repos.items.create({
      serverId: input.serverId,
      projectId,
      createdBy: input.actor.id,
      assignedTo: input.assignedTo?.id ?? null,
      type: 'task',
      title,
      content: input.description?.trim() || null,
      status: 'pending',
      priority: input.priority ?? 'medium',
      dueAt: input.dueAt ? input.dueAt.toISOString() : null,
    });
  }

  list(input: ListTasksInput): ItemWithProject[] {
    const filter: Parameters<Repositories['items']['list']>[0] = {
      serverId: input.serverId,
      type: 'task',
      limit: input.limit ?? 200,
    };
    if (input.projectId !== undefined) filter.projectId = input.projectId;
    if (input.assignedTo !== undefined) filter.assignedTo = input.assignedTo;
    if (input.status !== undefined) filter.status = input.status;
    else if (!input.includeClosed) filter.notStatus = CLOSED_STATUSES;

    return this.repos.items.list(filter);
  }

  /** Tarefas abertas atribuidas ao usuario, base do `/minhas`. */
  mine(serverId: string, userId: number, limit = 50): ItemWithProject[] {
    return this.repos.items.list({
      serverId,
      type: 'task',
      assignedTo: userId,
      notStatus: CLOSED_STATUSES,
      limit,
    });
  }

  require(serverId: string, taskId: number): ItemRow {
    const task = this.repos.items.findByIdInServer(taskId, serverId);
    if (!task || task.type !== 'task') {
      throw new NotFoundError(`Tarefa \`#${taskId}\` nao encontrada neste servidor.`);
    }
    return task;
  }

  detail(serverId: string, taskId: number): ItemWithProject {
    const task = this.repos.items.findDetailedByIdInServer(taskId, serverId);
    if (!task || task.type !== 'task') {
      throw new NotFoundError(`Tarefa \`#${taskId}\` nao encontrada neste servidor.`);
    }
    return task;
  }

  complete(serverId: string, taskId: number, actor: UserRow, isAdmin: boolean): ItemRow {
    const task = this.require(serverId, taskId);
    assertCanManageItem(task, actor, isAdmin);
    if (task.status === 'done') throw new ValidationError('Essa tarefa ja esta concluida.');
    return this.repos.items.update(task.id, { status: 'done' }) as ItemRow;
  }

  cancel(serverId: string, taskId: number, actor: UserRow, isAdmin: boolean): ItemRow {
    const task = this.require(serverId, taskId);
    assertCanManageItem(task, actor, isAdmin);
    if (task.status === 'cancelled') throw new ValidationError('Essa tarefa ja esta cancelada.');
    return this.repos.items.update(task.id, { status: 'cancelled' }) as ItemRow;
  }

  remove(serverId: string, taskId: number, actor: UserRow, isAdmin: boolean): ItemRow {
    const task = this.require(serverId, taskId);
    assertCanManageItem(task, actor, isAdmin);
    this.repos.items.remove(task.id);
    return task;
  }

  edit(
    serverId: string,
    taskId: number,
    patch: EditTaskInput,
    actor: UserRow,
    isAdmin: boolean,
  ): ItemRow {
    const task = this.require(serverId, taskId);
    assertCanManageItem(task, actor, isAdmin);

    const update: Parameters<Repositories['items']['update']>[1] = {};

    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (title.length < 2) throw new ValidationError('O titulo precisa ter pelo menos 2 caracteres.');
      if (title.length > TITLE_MAX) {
        throw new ValidationError(`O titulo deve ter no maximo ${TITLE_MAX} caracteres.`);
      }
      update.title = title;
    }
    if (patch.description !== undefined) {
      if (patch.description && patch.description.length > CONTENT_MAX) {
        throw new ValidationError(`A descricao deve ter no maximo ${CONTENT_MAX} caracteres.`);
      }
      update.content = patch.description?.trim() || null;
    }
    if (patch.priority !== undefined) update.priority = patch.priority;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.clearDueAt) update.dueAt = null;
    else if (patch.dueAt !== undefined) update.dueAt = patch.dueAt ? patch.dueAt.toISOString() : null;
    if (patch.assignedTo !== undefined) update.assignedTo = patch.assignedTo?.id ?? null;
    if (patch.projectId !== undefined) {
      update.projectId = this.normalizeProjectId(serverId, patch.projectId);
    }

    if (Object.keys(update).length === 0) {
      throw new ValidationError('Informe pelo menos um campo para editar.');
    }

    return this.repos.items.update(task.id, update) as ItemRow;
  }

  /** Autocomplete de tarefas abertas (as fechadas nao poluem a lista). */
  autocomplete(serverId: string, term: string): { name: string; value: number }[] {
    return this.repos.items
      .autocomplete(serverId, 'task', term, { excludeStatus: CLOSED_STATUSES })
      .map((task) => ({
        name: `#${task.id} · ${task.title}`.slice(0, 100),
        value: task.id,
      }));
  }

  private normalizeProjectId(serverId: string, projectId: number | null | undefined): number | null {
    if (projectId === null || projectId === undefined) return null;
    const project = this.repos.projects.findByIdInServer(projectId, serverId);
    if (!project) throw new NotFoundError('Projeto nao encontrado neste servidor.');
    return project.id;
  }
}
