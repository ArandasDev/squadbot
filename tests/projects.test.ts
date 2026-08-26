import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, makeUser, SERVER_A, SERVER_B } from './helpers.js';
import type { AppContext } from '../src/services/index.js';
import { PermissionError, ValidationError } from '../src/utils/errors.js';

describe('ProjectService', () => {
  let context: AppContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    context.db.close();
  });

  it('cria um projeto e vincula o criador como membro', () => {
    const joao = makeUser(context, SERVER_A, 'joao');

    const project = context.services.projects.create(
      SERVER_A,
      'Backend',
      'API principal do produto',
      joao,
    );

    expect(project.id).toBeGreaterThan(0);
    expect(project.name).toBe('Backend');
    expect(project.description).toBe('API principal do produto');
    expect(project.status).toBe('active');
    expect(project.server_id).toBe(SERVER_A);
    expect(project.created_by).toBe(joao.id);

    const members = context.services.projects.members(project.id);
    expect(members.map((member) => member.id)).toEqual([joao.id]);
  });

  it('rejeita nome duplicado no mesmo servidor (ignorando maiusculas)', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    context.services.projects.create(SERVER_A, 'Backend', null, joao);

    expect(() => context.services.projects.create(SERVER_A, 'backend', null, joao)).toThrow(
      ValidationError,
    );
  });

  it('permite o mesmo nome de projeto em servidores diferentes', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_B, 'maria');

    const a = context.services.projects.create(SERVER_A, 'Backend', null, joao);
    const b = context.services.projects.create(SERVER_B, 'Backend', null, maria);

    expect(a.id).not.toBe(b.id);
    expect(context.services.projects.list(SERVER_A)).toHaveLength(1);
    expect(context.services.projects.list(SERVER_B)).toHaveLength(1);
  });

  it('rejeita nome curto demais', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    expect(() => context.services.projects.create(SERVER_A, 'B', null, joao)).toThrow(ValidationError);
  });

  it('adiciona e remove membros', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const project = context.services.projects.create(SERVER_A, 'Backend', null, joao);

    context.services.projects.addMember(SERVER_A, project.id, maria, joao, false);
    expect(context.services.projects.members(project.id)).toHaveLength(2);

    context.services.projects.removeMember(SERVER_A, project.id, maria, joao, false);
    expect(context.services.projects.members(project.id)).toHaveLength(1);
  });

  it('impede que um membro comum gerencie projeto de outra pessoa', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const project = context.services.projects.create(SERVER_A, 'Backend', null, joao);

    expect(() =>
      context.services.projects.addMember(SERVER_A, project.id, maria, maria, false),
    ).toThrow(PermissionError);
  });

  it('permite que um administrador gerencie qualquer projeto', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const admin = makeUser(context, SERVER_A, 'admin');
    const project = context.services.projects.create(SERVER_A, 'Backend', null, joao);

    const archived = context.services.projects.setStatus(
      SERVER_A,
      project.id,
      'archived',
      admin,
      true,
    );
    expect(archived.status).toBe('archived');
  });

  it('nao encontra projeto de outro servidor', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const project = context.services.projects.create(SERVER_A, 'Backend', null, joao);

    expect(context.services.projects.resolve(SERVER_B, String(project.id))).toBeUndefined();
    expect(() => context.services.projects.requireById(SERVER_B, project.id)).toThrow();
  });

  it('arquiva e reativa mantendo o historico', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const project = context.services.projects.create(SERVER_A, 'Backend', null, joao);

    context.services.projects.setStatus(SERVER_A, project.id, 'archived', joao, false);
    expect(context.services.projects.list(SERVER_A, 'active')).toHaveLength(0);
    expect(context.services.projects.list(SERVER_A, 'archived')).toHaveLength(1);

    context.services.projects.setStatus(SERVER_A, project.id, 'active', joao, false);
    expect(context.services.projects.list(SERVER_A, 'active')).toHaveLength(1);
  });
});
