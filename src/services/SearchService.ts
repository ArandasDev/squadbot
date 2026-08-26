import type { ItemWithProject, Repositories } from '../database/repositories/index.js';
import type { ItemType } from '../types/index.js';
import { ValidationError } from '../utils/errors.js';

export interface SearchResult {
  term: string;
  total: number;
  byType: Record<ItemType, ItemWithProject[]>;
  all: ItemWithProject[];
}

const EMPTY_BY_TYPE = (): Record<ItemType, ItemWithProject[]> => ({
  task: [],
  note: [],
  idea: [],
  decision: [],
  link: [],
});

/**
 * Busca textual unificada sobre tarefas, notas, ideias, decisoes e links.
 *
 * O `server_id` é sempre parte do filtro: uma busca feita em um servidor nunca
 * retorna registros de outro.
 */
export class SearchService {
  constructor(private readonly repos: Repositories) {}

  search(serverId: string, term: string, types?: readonly ItemType[], limit = 50): SearchResult {
    const clean = term.trim();
    if (clean.length < 2) {
      throw new ValidationError('O termo de busca precisa ter pelo menos 2 caracteres.');
    }

    const all = this.repos.items.search(serverId, clean, types, limit);
    const byType = EMPTY_BY_TYPE();
    for (const item of all) {
      byType[item.type].push(item);
    }

    return { term: clean, total: all.length, byType, all };
  }
}
