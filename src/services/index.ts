import type { Database } from '../database/Database.js';
import { createRepositories, type Repositories } from '../database/repositories/index.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../utils/logger.js';
import { UserService } from './UserService.js';
import { ProjectService } from './ProjectService.js';
import { TaskService } from './TaskService.js';
import { NoteService } from './NoteService.js';
import { IdeaService } from './IdeaService.js';
import { DecisionService } from './DecisionService.js';
import { LinkService } from './LinkService.js';
import { ReminderService } from './ReminderService.js';
import { SearchService } from './SearchService.js';

export { UserService } from './UserService.js';
export { ProjectService } from './ProjectService.js';
export { TaskService } from './TaskService.js';
export { NoteService } from './NoteService.js';
export { IdeaService } from './IdeaService.js';
export { DecisionService } from './DecisionService.js';
export { LinkService } from './LinkService.js';
export { ReminderService } from './ReminderService.js';
export { SearchService } from './SearchService.js';

export interface Services {
  users: UserService;
  projects: ProjectService;
  tasks: TaskService;
  notes: NoteService;
  ideas: IdeaService;
  decisions: DecisionService;
  links: LinkService;
  reminders: ReminderService;
  search: SearchService;
}

export function createServices(repos: Repositories, defaultTimezone: string): Services {
  return {
    users: new UserService(repos, defaultTimezone),
    projects: new ProjectService(repos),
    tasks: new TaskService(repos),
    notes: new NoteService(repos),
    ideas: new IdeaService(repos),
    decisions: new DecisionService(repos),
    links: new LinkService(repos),
    reminders: new ReminderService(repos),
    search: new SearchService(repos),
  };
}

/**
 * Contexto compartilhado por comandos, eventos e workers.
 * Injetar este objeto (em vez de usar singletons) mantem os testes simples:
 * basta montar um contexto sobre um banco `:memory:`.
 */
export interface AppContext {
  config: AppConfig;
  logger: Logger;
  db: Database;
  repos: Repositories;
  services: Services;
}

export function createContext(db: Database, config: AppConfig, logger: Logger): AppContext {
  const repos = createRepositories(db);
  return {
    config,
    logger,
    db,
    repos,
    services: createServices(repos, config.defaultTimezone),
  };
}
