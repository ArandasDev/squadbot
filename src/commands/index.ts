import type { SlashCommand } from './shared.js';
import { projectCommand } from './project/index.js';
import { taskCommand } from './task/index.js';
import { noteCommand } from './note/index.js';
import { ideaCommand } from './idea/index.js';
import { decisionCommand } from './decision/index.js';
import { linkCommand } from './link/index.js';
import { reminderCommand } from './reminder/index.js';
import { generalCommands } from './general/index.js';

export type { SlashCommand, CommandInvocation, AutocompleteInvocation } from './shared.js';

/**
 * Registro estatico de comandos.
 *
 * A importacao é explicita (em vez de varrer o diretorio) porque isso funciona
 * igual em `tsx` e no JavaScript compilado em `dist/`, e qualquer comando quebrado
 * falha no build, nao em producao.
 */
export const allCommands: SlashCommand[] = [
  projectCommand,
  taskCommand,
  noteCommand,
  ideaCommand,
  decisionCommand,
  linkCommand,
  reminderCommand,
  ...generalCommands,
];
