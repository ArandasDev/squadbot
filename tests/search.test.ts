import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, makeUser, SERVER_A, SERVER_B } from './helpers.js';
import type { AppContext } from '../src/services/index.js';
import { ValidationError } from '../src/utils/errors.js';

describe('SearchService', () => {
  let context: AppContext;

  beforeEach(() => {
    context = createTestContext();

    const joao = makeUser(context, SERVER_A, 'joao');
    context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Implementar autenticacao',
    });
    context.services.notes.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Fluxo de login',
      content: 'A autenticacao usa JWT com refresh token.',
    });
    context.services.ideas.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Autenticacao por magic link',
    });
    context.services.decisions.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Banco de producao',
      content: 'Vamos utilizar PostgreSQL em producao.',
    });
    context.services.links.createLink({
      serverId: SERVER_A,
      actor: joao,
      name: 'Docs de autenticacao',
      url: 'https://example.com/auth',
    });
  });

  afterEach(() => {
    context.db.close();
  });

  it('encontra registros de todos os tipos pelo titulo e pelo conteudo', () => {
    const result = context.services.search.search(SERVER_A, 'autenticacao');

    expect(result.total).toBe(4);
    expect(result.byType.task).toHaveLength(1);
    expect(result.byType.note).toHaveLength(1);
    expect(result.byType.idea).toHaveLength(1);
    expect(result.byType.link).toHaveLength(1);
    expect(result.byType.decision).toHaveLength(0);
  });

  it('filtra por tipo quando solicitado', () => {
    const result = context.services.search.search(SERVER_A, 'autenticacao', ['note']);
    expect(result.total).toBe(1);
    expect(result.all[0]?.type).toBe('note');
  });

  it('encontra pelo conteudo, nao apenas pelo titulo', () => {
    const result = context.services.search.search(SERVER_A, 'PostgreSQL');
    expect(result.total).toBe(1);
    expect(result.all[0]?.title).toBe('Banco de producao');
  });

  it('exige um termo minimamente util', () => {
    expect(() => context.services.search.search(SERVER_A, 'a')).toThrow(ValidationError);
  });

  it('trata curingas do LIKE como texto literal', () => {
    // "%" nao pode virar "casa com tudo".
    const result = context.services.search.search(SERVER_A, '%%');
    expect(result.total).toBe(0);
  });

  it('nunca retorna registros de outro servidor', () => {
    const maria = makeUser(context, SERVER_B, 'maria');
    context.services.notes.create({
      serverId: SERVER_B,
      actor: maria,
      title: 'Autenticacao do servidor B',
      content: 'Segredo do outro squad.',
    });

    const fromA = context.services.search.search(SERVER_A, 'autenticacao');
    const fromB = context.services.search.search(SERVER_B, 'autenticacao');

    expect(fromA.total).toBe(4);
    expect(fromA.all.every((item) => item.server_id === SERVER_A)).toBe(true);

    expect(fromB.total).toBe(1);
    expect(fromB.all[0]?.title).toBe('Autenticacao do servidor B');
  });
});
