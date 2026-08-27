import type { ItemWithProject, Repositories } from '../database/repositories/index.js';
import type { ItemRow, ItemType, UserRow } from '../types/index.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { assertCanManageItem } from '../utils/permissions.js';

export const TITLE_MAX = 200;
export const CONTENT_MAX = 4000;

export interface CreateContentItemInput {
  serverId: string;
  actor: UserRow;
  title: string;
  content?: string | null;
  projectId?: number | null;
}

/**
 * Comportamento comum de notas, ideias, decisoes e links — todos sao linhas da
 * tabela `items`, mudando apenas `type`, o status inicial e validacoes extras.
 */
export abstract class BaseItemService {
  protected constructor(
    protected readonly repos: Repositories,
    protected readonly type: ItemType,
    protected readonly initialStatus: string,
    protected readonly labelSingular: string,
  ) {}

  create(input: CreateContentItemInput): ItemRow {
    const title = input.title.trim();
    if (title.length < 2) {
      throw new ValidationError(`O titulo d${this.labelSingular} precisa ter pelo menos 2 caracteres.`);
    }
    if (title.length > TITLE_MAX) {
      throw new ValidationError(`O titulo deve ter no maximo ${TITLE_MAX} caracteres.`);
    }

    const content = this.normalizeContent(input.content ?? null);

    return this.repos.items.create({
      serverId: input.serverId,
      projectId: this.normalizeProjectId(input.serverId, input.projectId),
      createdBy: input.actor.id,
      assignedTo: null,
      type: this.type,
      title,
      content,
      status: this.initialStatus,
      priority: null,
      dueAt: null,
    });
  }

  list(serverId: string, projectId?: number | null, limit = 200): ItemWithProject[] {
    const filter: Parameters<Repositories['items']['list']>[0] = {
      serverId,
      type: this.type,
      limit,
    };
    if (projectId !== undefined) filter.projectId = projectId;
    return this.repos.items.list(filter);
  }

  require(serverId: string, id: number): ItemRow {
    const item = this.repos.items.findByIdInServer(id, serverId);
    if (!item || item.type !== this.type) {
      throw new NotFoundError(`Registro \`#${id}\` nao encontrado neste servidor.`);
    }
    return item;
  }

  detail(serverId: string, id: number): ItemWithProject {
    const item = this.repos.items.findDetailedByIdInServer(id, serverId);
    if (!item || item.type !== this.type) {
      throw new NotFoundError(`Registro \`#${id}\` nao encontrado neste servidor.`);
    }
    return item;
  }

  remove(serverId: string, id: number, actor: UserRow, isAdmin: boolean): ItemRow {
    const item = this.require(serverId, id);
    assertCanManageItem(item, actor, isAdmin);
    this.repos.items.remove(item.id);
    return item;
  }

  autocomplete(serverId: string, term: string): { name: string; value: number }[] {
    return this.repos.items.autocomplete(serverId, this.type, term).map((item) => ({
      name: `#${item.id} · ${item.title}`.slice(0, 100),
      value: item.id,
    }));
  }

  /** Ponto de extensao: `LinkService` valida a URL aqui. */
  protected normalizeContent(content: string | null): string | null {
    if (content === null) return null;
    const trimmed = content.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > CONTENT_MAX) {
      throw new ValidationError(`O conteudo deve ter no maximo ${CONTENT_MAX} caracteres.`);
    }
    return trimmed;
  }

  protected normalizeProjectId(serverId: string, projectId: number | null | undefined): number | null {
    if (projectId === null || projectId === undefined) return null;
    const project = this.repos.projects.findByIdInServer(projectId, serverId);
    if (!project) throw new NotFoundError('Projeto nao encontrado neste servidor.');
    return project.id;
  }
}
