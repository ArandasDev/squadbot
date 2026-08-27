import { BaseItemService } from './BaseItemService.js';
import type { Repositories } from '../database/repositories/index.js';

/** Anotacoes do squad: conhecimento que precisa sobreviver ao scroll do chat. */
export class NoteService extends BaseItemService {
  constructor(repos: Repositories) {
    super(repos, 'note', 'active', 'a nota');
  }
}
