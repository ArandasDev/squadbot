import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, makeUser, SERVER_A, SERVER_B } from './helpers.js';
import type { AppContext } from '../src/services/index.js';
import { assertIsAdmin, canManageItem, canManageProject } from '../src/utils/permissions.js';
import { PermissionError } from '../src/utils/errors.js';

describe('Permissoes', () => {
  let context: AppContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    context.db.close();
  });

  it('autor gerencia o proprio registro; terceiro nao', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const note = context.services.notes.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Nota do joao',
      content: 'conteudo',
    });

    expect(canManageItem(note, joao, false)).toBe(true);
    expect(canManageItem(note, maria, false)).toBe(false);
    expect(canManageItem(note, maria, true)).toBe(true);
  });

  it('responsavel gerencia a tarefa atribuida a ele', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const carlos = makeUser(context, SERVER_A, 'carlos');

    const task = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Revisar API',
      assignedTo: maria,
    });

    expect(canManageItem(task, maria, false)).toBe(true);
    expect(canManageItem(task, carlos, false)).toBe(false);
  });

  it('nota atribuida nao herda a regra de responsavel das tarefas', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const note = context.services.notes.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Nota',
      content: 'conteudo',
    });

    const forged = { ...note, assigned_to: maria.id };
    expect(canManageItem(forged, maria, false)).toBe(false);
  });

  it('projeto é gerido pelo criador ou por um admin', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const project = context.services.projects.create(SERVER_A, 'Backend', null, joao);

    expect(canManageProject(project, joao, false)).toBe(true);
    expect(canManageProject(project, maria, false)).toBe(false);
    expect(canManageProject(project, maria, true)).toBe(true);
  });

  it('assertIsAdmin bloqueia nao administradores', () => {
    expect(() => assertIsAdmin(false, 'configurar o bot')).toThrow(PermissionError);
    expect(() => assertIsAdmin(true, 'configurar o bot')).not.toThrow();
  });

  it('timezone do usuario e do servidor sao independentes e escopados', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    makeUser(context, SERVER_B, 'maria');

    expect(joao.timezone).toBe('America/Sao_Paulo');

    context.services.users.setServerTimezone(SERVER_A, 'Europe/Lisbon');
    expect(context.services.users.serverTimezone(SERVER_A)).toBe('Europe/Lisbon');
    expect(context.services.users.serverTimezone(SERVER_B)).toBe('America/Sao_Paulo');

    // Quem ja existia mantem o proprio fuso ate mudar explicitamente.
    expect(context.services.users.findById(joao.id)?.timezone).toBe('America/Sao_Paulo');

    const novo = makeUser(context, SERVER_A, 'carlos');
    expect(novo.timezone).toBe('Europe/Lisbon');
  });

  it('recusa timezone invalido', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    expect(() => context.services.users.setUserTimezone(joao.id, 'Nao/Existe')).toThrow();
  });

  it('o mesmo usuario do Discord tem linhas independentes por servidor', () => {
    const discordId = '999999999999999999';
    const emA = context.services.users.ensure(SERVER_A, { discordId, username: 'joao' });
    const emB = context.services.users.ensure(SERVER_B, { discordId, username: 'joao' });

    expect(emA.id).not.toBe(emB.id);
    expect(emA.discord_id).toBe(emB.discord_id);

    context.services.users.setUserTimezone(emA.id, 'UTC');
    expect(context.services.users.findById(emB.id)?.timezone).toBe('America/Sao_Paulo');
  });
});
