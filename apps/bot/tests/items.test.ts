import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, makeUser, SERVER_A, SERVER_B } from './helpers.js';
import type { AppContext } from '../src/services/index.js';
import { PermissionError, ValidationError } from '../src/utils/errors.js';

describe('Notas, ideias, decisoes e links', () => {
  let context: AppContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    context.db.close();
  });

  it('cria uma nota vinculada a um projeto', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const project = context.services.projects.create(SERVER_A, 'Backend', null, joao);

    const note = context.services.notes.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Producao',
      content: 'O servidor de producao utiliza a porta 8080.',
      projectId: project.id,
    });

    expect(note.type).toBe('note');
    expect(note.status).toBe('active');
    expect(note.project_id).toBe(project.id);
    expect(note.content).toBe('O servidor de producao utiliza a porta 8080.');
    expect(context.services.notes.list(SERVER_A)).toHaveLength(1);
  });

  it('cria uma ideia com status inicial "new" e avanca o ciclo de vida', () => {
    const joao = makeUser(context, SERVER_A, 'joao');

    const idea = context.services.ideas.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Sistema de metricas',
    });

    expect(idea.type).toBe('idea');
    expect(idea.status).toBe('new');
    expect(context.services.ideas.countNew(SERVER_A)).toBe(1);

    const accepted = context.services.ideas.setStatus(SERVER_A, idea.id, 'accepted', joao, false);
    expect(accepted.status).toBe('accepted');

    const implemented = context.services.ideas.setStatus(
      SERVER_A,
      idea.id,
      'implemented',
      joao,
      false,
    );
    expect(implemented.status).toBe('implemented');
    expect(context.services.ideas.countNew(SERVER_A)).toBe(0);
  });

  it('rejeita uma ideia e a tira das ideias em aberto', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const idea = context.services.ideas.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Reescrever tudo em Rust',
    });

    context.services.ideas.setStatus(SERVER_A, idea.id, 'rejected', joao, false);
    expect(context.services.ideas.latestOpen(SERVER_A)).toHaveLength(0);
  });

  it('cria uma decisao como memoria historica do squad', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const project = context.services.projects.create(SERVER_A, 'Backend', null, joao);

    const decision = context.services.decisions.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Banco de producao',
      content: 'Vamos utilizar PostgreSQL em producao.',
      projectId: project.id,
    });

    expect(decision.type).toBe('decision');
    expect(decision.content).toBe('Vamos utilizar PostgreSQL em producao.');
    expect(context.services.decisions.list(SERVER_A)).toHaveLength(1);
  });

  it('guarda links validos e recusa URLs invalidas', () => {
    const joao = makeUser(context, SERVER_A, 'joao');

    const link = context.services.links.createLink({
      serverId: SERVER_A,
      actor: joao,
      name: 'Documentacao da API',
      url: 'https://example.com/docs',
    });

    expect(link.type).toBe('link');
    expect(link.content).toBe('https://example.com/docs');

    expect(() =>
      context.services.links.createLink({
        serverId: SERVER_A,
        actor: joao,
        name: 'Invalido',
        url: 'nao-e-uma-url',
      }),
    ).toThrow(ValidationError);

    // Protocolos perigosos nao viram link clicavel no Discord.
    expect(() =>
      context.services.links.createLink({
        serverId: SERVER_A,
        actor: joao,
        name: 'Script',
        url: 'javascript:alert(1)',
      }),
    ).toThrow(ValidationError);
  });

  it('so o autor ou um admin excluem um registro', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const note = context.services.notes.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Credenciais de staging',
      content: 'Estao no cofre da equipe.',
    });

    expect(() => context.services.notes.remove(SERVER_A, note.id, maria, false)).toThrow(
      PermissionError,
    );

    context.services.notes.remove(SERVER_A, note.id, maria, true);
    expect(context.repos.items.findById(note.id)).toBeUndefined();
  });

  it('mantem os registros isolados por servidor', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_B, 'maria');

    context.services.notes.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Nota do servidor A',
      content: 'Conteudo A',
    });
    context.services.notes.create({
      serverId: SERVER_B,
      actor: maria,
      title: 'Nota do servidor B',
      content: 'Conteudo B',
    });

    const listA = context.services.notes.list(SERVER_A);
    const listB = context.services.notes.list(SERVER_B);

    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(1);
    expect(listA[0]?.title).toBe('Nota do servidor A');
    expect(listB[0]?.title).toBe('Nota do servidor B');
  });
});
