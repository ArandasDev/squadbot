import { BaseItemService } from './BaseItemService.js';
import type { Repositories } from '../database/repositories/index.js';

/**
 * Decisoes funcionam como memoria historica: registram o QUE foi decidido e o
 * PORQUE. Por isso nao expomos edicao — o historico nao deve ser reescrito.
 */
export class DecisionService extends BaseItemService {
  constructor(repos: Repositories) {
    super(repos, 'decision', 'active', 'a decisao');
  }
}
