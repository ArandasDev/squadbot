import type { Database } from '../Database.js';
import { UserRepository } from './UserRepository.js';
import { ProjectRepository } from './ProjectRepository.js';
import { ItemRepository } from './ItemRepository.js';
import { ReminderRepository } from './ReminderRepository.js';
import { ServerSettingsRepository } from './ServerSettingsRepository.js';

export { UserRepository } from './UserRepository.js';
export { ProjectRepository } from './ProjectRepository.js';
export { ItemRepository } from './ItemRepository.js';
export { ReminderRepository } from './ReminderRepository.js';
export { ServerSettingsRepository } from './ServerSettingsRepository.js';

export type { CreateProjectInput } from './ProjectRepository.js';
export type { ItemWithProject, UpdateItemPatch } from './ItemRepository.js';
export type { ReminderWithTargets } from './ReminderRepository.js';
export type { ServerSettingsRow } from './ServerSettingsRepository.js';

export interface Repositories {
  users: UserRepository;
  projects: ProjectRepository;
  items: ItemRepository;
  reminders: ReminderRepository;
  serverSettings: ServerSettingsRepository;
}

export function createRepositories(db: Database): Repositories {
  return {
    users: new UserRepository(db),
    projects: new ProjectRepository(db),
    items: new ItemRepository(db),
    reminders: new ReminderRepository(db),
    serverSettings: new ServerSettingsRepository(db),
  };
}
