import type { SlashCommand } from '../shared.js';
import { searchCommand } from './search.js';
import { mineCommand } from './mine.js';
import { summaryCommand } from './summary.js';
import { configCommand } from './config.js';
import { helpCommand } from './help.js';

export { searchCommand } from './search.js';
export { mineCommand } from './mine.js';
export { summaryCommand } from './summary.js';
export { configCommand } from './config.js';
export { helpCommand } from './help.js';

export const generalCommands: SlashCommand[] = [
  searchCommand,
  mineCommand,
  summaryCommand,
  configCommand,
  helpCommand,
];
