import { BaseItemService } from './BaseItemService.js';
import type { ItemWithProject, Repositories } from '../database/repositories/index.js';
import type { IdeaStatus, ItemRow, UserRow } from '../types/index.js';
import { IDEA_STATUSES } from '../types/index.js';
import { ValidationError } from '../utils/errors.js';
import { assertCanManageItem } from '../utils/permissions.js';

export function isIdeaStatus(value: string): value is IdeaStatus {
  return (IDEA_STATUSES as readonly string[]).includes(value);
}

/** Ideias tem ciclo de vida proprio: new -> considering -> accepted -> implemented (ou rejected). */
export class IdeaService extends BaseItemService {
  constructor(repos: Repositories) {
    super(repos, 'idea', 'new', 'a ideia');
  }

  setStatus(
    serverId: string,
    ideaId: number,
    status: IdeaStatus,
    actor: UserRow,
    isAdmin: boolean,
  ): ItemRow {
    const idea = this.require(serverId, ideaId);
    assertCanManageItem(idea, actor, isAdmin);
    if (idea.status === status) {
      throw new ValidationError('A ideia ja esta nesse status.');
    }
    return this.repos.items.update(idea.id, { status }) as ItemRow;
  }

  listByStatus(serverId: string, status: IdeaStatus, limit = 200): ItemWithProject[] {
    return this.repos.items.list({ serverId, type: 'idea', status, limit });
  }

  /** Ideias mais recentes ainda em aberto — usado por `/minhas` e `/resumo`. */
  latestOpen(serverId: string, limit = 5): ItemWithProject[] {
    return this.repos.items
      .list({
        serverId,
        type: 'idea',
        notStatus: ['rejected', 'implemented'],
        limit,
      })
      .slice(0, limit);
  }

  countNew(serverId: string): number {
    return this.repos.items.count({ serverId, type: 'idea', status: 'new' });
  }
}
