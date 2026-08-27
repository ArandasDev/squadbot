import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, makeUser, SERVER_A, SERVER_B } from './helpers.js';
import type { AppContext } from '../src/services/index.js';
import { PermissionError, ValidationError } from '../src/utils/errors.js';

describe('TaskService', () => {
  let context: AppContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    context.db.close();
  });

  it('cria uma tarefa com projeto, responsavel, prioridade e prazo', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const project = context.services.projects.create(SERVER_A, 'Backend', null, joao);
    const dueAt = new Date('2026-08-28T23:59:00.000Z');

    const task = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Implementar autenticacao',
      projectId: project.id,
      assignedTo: maria,
      priority: 'high',
      dueAt,
      description: 'JWT + refresh token',
    });

    expect(task.type).toBe('task');
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('high');
    expect(task.project_id).toBe(project.id);
    expect(task.created_by).toBe(joao.id);
    expect(task.assigned_to).toBe(maria.id);
    expect(task.content).toBe('JWT + refresh token');
    // Prazos sao persistidos em UTC ISO 8601.
    expect(task.due_at).toBe('2026-08-28T23:59:00.000Z');
  });

  it('usa prioridade media por padrao e aceita tarefa sem projeto', () => {
    const joao = makeUser(context, SERVER_A, 'joao');

    const task = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Comprar dominio',
    });

    expect(task.priority).toBe('medium');
    expect(task.project_id).toBeNull();
    expect(task.assigned_to).toBeNull();
  });

  it('rejeita titulo curto demais', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    expect(() =>
      context.services.tasks.create({ serverId: SERVER_A, actor: joao, title: 'x' }),
    ).toThrow(ValidationError);
  });

  it('conclui uma tarefa', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const task = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Revisar API',
    });

    const done = context.services.tasks.complete(SERVER_A, task.id, joao, false);

    expect(done.status).toBe('done');
    expect(context.services.tasks.mine(SERVER_A, joao.id)).toHaveLength(0);
  });

  it('nao conclui duas vezes a mesma tarefa', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const task = context.services.tasks.create({ serverId: SERVER_A, actor: joao, title: 'Deploy' });

    context.services.tasks.complete(SERVER_A, task.id, joao, false);
    expect(() => context.services.tasks.complete(SERVER_A, task.id, joao, false)).toThrow(
      ValidationError,
    );
  });

  it('deixa o responsavel concluir a tarefa que nao foi ele quem criou', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const task = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Revisar PR',
      assignedTo: maria,
    });

    const done = context.services.tasks.complete(SERVER_A, task.id, maria, false);
    expect(done.status).toBe('done');
  });

  it('impede que um terceiro sem permissao altere a tarefa', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const carlos = makeUser(context, SERVER_A, 'carlos');
    const task = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Revisar PR',
      assignedTo: maria,
    });

    expect(() => context.services.tasks.complete(SERVER_A, task.id, carlos, false)).toThrow(
      PermissionError,
    );
    // Administrador pode.
    expect(context.services.tasks.complete(SERVER_A, task.id, carlos, true).status).toBe('done');
  });

  it('cancela e exclui tarefas', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const cancelavel = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Migrar para Postgres',
    });
    const excluivel = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Tarefa duplicada',
    });

    expect(context.services.tasks.cancel(SERVER_A, cancelavel.id, joao, false).status).toBe(
      'cancelled',
    );

    context.services.tasks.remove(SERVER_A, excluivel.id, joao, false);
    expect(context.repos.items.findById(excluivel.id)).toBeUndefined();
  });

  it('edita titulo, status, prioridade e responsavel', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const task = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Documentar endpoints',
    });

    const updated = context.services.tasks.edit(
      SERVER_A,
      task.id,
      {
        title: 'Documentar endpoints da API',
        status: 'in_progress',
        priority: 'urgent',
        assignedTo: maria,
      },
      joao,
      false,
    );

    expect(updated.title).toBe('Documentar endpoints da API');
    expect(updated.status).toBe('in_progress');
    expect(updated.priority).toBe('urgent');
    expect(updated.assigned_to).toBe(maria.id);
  });

  it('lista apenas tarefas abertas por padrao', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const aberta = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Tarefa aberta',
    });
    const fechada = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Tarefa fechada',
    });
    context.services.tasks.complete(SERVER_A, fechada.id, joao, false);

    const abertas = context.services.tasks.list({ serverId: SERVER_A });
    expect(abertas.map((task) => task.id)).toEqual([aberta.id]);

    const todas = context.services.tasks.list({ serverId: SERVER_A, includeClosed: true });
    expect(todas).toHaveLength(2);
  });

  it('nao alcanca tarefas de outro servidor', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const task = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Segredo do servidor A',
    });

    expect(context.services.tasks.list({ serverId: SERVER_B })).toHaveLength(0);
    expect(() => context.services.tasks.require(SERVER_B, task.id)).toThrow();
  });
});
