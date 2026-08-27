import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PermissionFlagsBits, type Client } from 'discord.js';
import type { FastifyInstance } from 'fastify';
import { createTestContext, makeUser, SERVER_A, SERVER_B } from './helpers.js';
import type { AppContext } from '../src/services/index.js';
import { createApiServer } from '../src/api/server.js';

const TOKEN = 'token-de-teste-super-secreto';

interface FakeMember {
  discordId: string;
  displayName: string;
  isAdmin: boolean;
}

/**
 * Client falso: implementa apenas a superficie que a API usa
 * (cache de guilds, fetch de membros e permissoes).
 */
function fakeClient(guilds: Record<string, { name: string; members: FakeMember[] }>): Client {
  const cache = new Map(
    Object.entries(guilds).map(([id, guild]) => [
      id,
      {
        id,
        name: guild.name,
        iconURL: () => null,
        members: {
          async fetch(discordId: string) {
            const member = guild.members.find((candidate) => candidate.discordId === discordId);
            if (!member) throw new Error('Unknown Member');
            return {
              id: member.discordId,
              displayName: member.displayName,
              permissions: {
                has(flag: bigint) {
                  return member.isAdmin && flag === PermissionFlagsBits.Administrator;
                },
              },
            };
          },
        },
      },
    ]),
  );

  return {
    isReady: () => true,
    guilds: {
      cache,
      fetch: async (id: string) => {
        const guild = cache.get(id);
        if (!guild) throw new Error('Unknown Guild');
        return guild;
      },
    },
  } as unknown as Client;
}

function headers(actorId: string, token = TOKEN): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'x-actor-id': actorId };
}

describe('API REST', () => {
  let context: AppContext;
  let app: FastifyInstance;

  const joaoId = '111';
  const mariaId = '222';
  const carlosId = '333';
  const forasteiroId = '444';

  beforeEach(async () => {
    context = createTestContext({ apiToken: TOKEN });

    const client = fakeClient({
      [SERVER_A]: {
        name: 'Squad A',
        members: [
          { discordId: joaoId, displayName: 'joao', isAdmin: false },
          { discordId: mariaId, displayName: 'maria', isAdmin: false },
          { discordId: carlosId, displayName: 'carlos', isAdmin: true },
        ],
      },
      [SERVER_B]: {
        name: 'Squad B',
        members: [{ discordId: forasteiroId, displayName: 'forasteiro', isAdmin: false }],
      },
    });

    app = createApiServer(context, client);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    context.db.close();
  });

  it('responde /health sem autenticacao', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', discordReady: true });
  });

  it('recusa requisicao sem token de servico', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/me`,
      headers: { 'x-actor-id': joaoId },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_TOKEN');
  });

  it('recusa token de servico incorreto', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/me`,
      headers: headers(joaoId, 'token-errado'),
    });
    expect(response.statusCode).toBe(401);
  });

  it('recusa requisicao sem identidade do ator', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/me`,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('MISSING_ACTOR');
  });

  it('recusa quem nao é membro do servidor', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/me`,
      headers: headers(forasteiroId),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('NOT_A_MEMBER');
  });

  it('resolve o ator e reporta se é administrador', async () => {
    const comum = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/me`,
      headers: headers(joaoId),
    });
    expect(comum.statusCode).toBe(200);
    expect(comum.json()).toMatchObject({
      isAdmin: false,
      user: { discordId: joaoId, username: 'joao', timezone: 'America/Sao_Paulo' },
      guild: { id: SERVER_A, name: 'Squad A' },
    });

    const admin = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/me`,
      headers: headers(carlosId),
    });
    expect(admin.json().isAdmin).toBe(true);
  });

  it('lista apenas os servidores em que o ator esta', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/guilds', headers: headers(joaoId) });
    expect(response.statusCode).toBe(200);
    expect(response.json().guilds).toEqual([{ id: SERVER_A, name: 'Squad A', iconUrl: null }]);

    const outro = await app.inject({
      method: 'GET',
      url: '/api/guilds',
      headers: headers(forasteiroId),
    });
    expect(outro.json().guilds).toEqual([{ id: SERVER_B, name: 'Squad B', iconUrl: null }]);
  });

  it('lista projetos e tarefas do servidor', async () => {
    const joao = makeUser(context, SERVER_A, 'joao', joaoId);
    const projeto = context.services.projects.create(SERVER_A, 'Backend', 'API', joao);
    context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Implementar autenticacao',
      projectId: projeto.id,
      priority: 'high',
    });

    const projetos = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/projects`,
      headers: headers(joaoId),
    });
    expect(projetos.json().projects).toHaveLength(1);
    expect(projetos.json().projects[0]).toMatchObject({
      name: 'Backend',
      status: 'active',
      taskCounts: { pending: 1, in_progress: 0, done: 0, cancelled: 0 },
    });

    const tarefas = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/tasks`,
      headers: headers(joaoId),
    });
    expect(tarefas.json().tasks[0]).toMatchObject({
      title: 'Implementar autenticacao',
      priority: 'high',
      status: 'pending',
      project: { name: 'Backend' },
    });
  });

  it('nunca expoe dados de outro servidor', async () => {
    const joao = makeUser(context, SERVER_A, 'joao', joaoId);
    context.services.notes.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Segredo do Squad A',
      content: 'Conteudo confidencial',
    });

    const forasteiro = makeUser(context, SERVER_B, 'forasteiro', forasteiroId);
    context.services.notes.create({
      serverId: SERVER_B,
      actor: forasteiro,
      title: 'Nota do Squad B',
      content: 'Outro conteudo',
    });

    const daGuildB = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_B}/items?type=note`,
      headers: headers(forasteiroId),
    });
    expect(daGuildB.json().items).toHaveLength(1);
    expect(daGuildB.json().items[0].title).toBe('Nota do Squad B');

    // Tentar ler a guild A com a identidade do outro servidor é barrado.
    const cruzado = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/items?type=note`,
      headers: headers(forasteiroId),
    });
    expect(cruzado.statusCode).toBe(403);

    // E a busca continua escopada.
    const busca = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_B}/search?q=Segredo`,
      headers: headers(forasteiroId),
    });
    expect(busca.json().total).toBe(0);
  });

  it('conclui uma tarefa e respeita as permissoes', async () => {
    const joao = makeUser(context, SERVER_A, 'joao', joaoId);
    const tarefa = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Revisar API',
    });

    // Maria nao criou nem é responsavel: 403.
    const negado = await app.inject({
      method: 'POST',
      url: `/api/guilds/${SERVER_A}/tasks/${tarefa.id}/complete`,
      headers: headers(mariaId),
    });
    expect(negado.statusCode).toBe(403);
    expect(context.repos.items.findById(tarefa.id)?.status).toBe('pending');

    // O autor pode.
    const ok = await app.inject({
      method: 'POST',
      url: `/api/guilds/${SERVER_A}/tasks/${tarefa.id}/complete`,
      headers: headers(joaoId),
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().status).toBe('done');
    expect(context.repos.items.findById(tarefa.id)?.status).toBe('done');

    // Concluir de novo vira erro de validacao.
    const repetido = await app.inject({
      method: 'POST',
      url: `/api/guilds/${SERVER_A}/tasks/${tarefa.id}/complete`,
      headers: headers(joaoId),
    });
    expect(repetido.statusCode).toBe(400);
  });

  it('deixa o administrador agir sobre registro de terceiros', async () => {
    const joao = makeUser(context, SERVER_A, 'joao', joaoId);
    makeUser(context, SERVER_A, 'carlos', carlosId);
    const tarefa = context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Tarefa do joao',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/guilds/${SERVER_A}/tasks/${tarefa.id}/cancel`,
      headers: headers(carlosId),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('cancelled');
  });

  it('atualiza o status de uma ideia', async () => {
    const joao = makeUser(context, SERVER_A, 'joao', joaoId);
    const ideia = context.services.ideas.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Sistema de metricas',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/guilds/${SERVER_A}/ideas/${ideia.id}/status`,
      headers: headers(joaoId),
      payload: { status: 'accepted' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('accepted');

    const invalido = await app.inject({
      method: 'POST',
      url: `/api/guilds/${SERVER_A}/ideas/${ideia.id}/status`,
      headers: headers(joaoId),
      payload: { status: 'nao-existe' },
    });
    expect(invalido.statusCode).toBe(400);
  });

  it('monta a visao pessoal e o resumo do squad', async () => {
    const joao = makeUser(context, SERVER_A, 'joao', joaoId);
    const projeto = context.services.projects.create(SERVER_A, 'Backend', null, joao);
    context.services.tasks.create({
      serverId: SERVER_A,
      actor: joao,
      title: 'Corrigir autenticacao',
      projectId: projeto.id,
      assignedTo: joao,
      priority: 'urgent',
    });
    context.services.ideas.create({ serverId: SERVER_A, actor: joao, title: 'Metricas' });
    context.services.reminders.create({
      serverId: SERVER_A,
      actor: joao,
      recipient: joao,
      whenInput: '2h',
      message: 'Fazer deploy',
    });

    const overview = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/overview`,
      headers: headers(joaoId),
    });
    expect(overview.json().tasks.total).toBe(1);
    expect(overview.json().tasks.urgent).toHaveLength(1);
    expect(overview.json().reminders).toHaveLength(1);
    expect(overview.json().ideas).toHaveLength(1);

    const summary = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/summary`,
      headers: headers(joaoId),
    });
    expect(summary.json()).toMatchObject({
      pendingReminders: 1,
      newIdeas: 1,
      unassigned: null,
    });
    expect(summary.json().projects[0]).toMatchObject({
      project: { name: 'Backend' },
      taskCounts: { pending: 1 },
    });
  });

  it('valida parametros invalidos', async () => {
    makeUser(context, SERVER_A, 'joao', joaoId);

    const tipoInvalido = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/items?type=banana`,
      headers: headers(joaoId),
    });
    expect(tipoInvalido.statusCode).toBe(400);

    const termoCurto = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/search?q=a`,
      headers: headers(joaoId),
    });
    expect(termoCurto.statusCode).toBe(400);

    const idInvalido = await app.inject({
      method: 'GET',
      url: `/api/guilds/${SERVER_A}/tasks/abc`,
      headers: headers(joaoId),
    });
    expect(idInvalido.statusCode).toBe(400);
  });
});
