import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { Client, Guild } from 'discord.js';
import type { AppContext } from '../services/index.js';
import { ApiError, extractBearer, resolveActor, tokensMatch, type RequestActor } from './auth.js';
import { isAppError, NotFoundError, PermissionError, ValidationError } from '../utils/errors.js';
import { isIdeaStatus } from '../services/IdeaService.js';
import { isTaskStatus } from '../services/TaskService.js';
import type { ItemType, Priority, ProjectStatus, TaskStatus } from '../types/index.js';
import { ITEM_TYPES } from '../types/index.js';
import {
  toItemDTO,
  toProjectDTO,
  toReminderDTO,
  toTaskCounts,
  toUserDTO,
  type GuildDTO,
  type ItemDTO,
  type MeDTO,
  type OverviewDTO,
  type ProjectDetailDTO,
  type SearchResultDTO,
  type SummaryDTO,
  type SummaryProjectDTO,
} from './dto.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchido pelo hook de autenticacao nas rotas com `:guildId`. */
    actor?: RequestActor;
    /** Id do Discord do ator, para rotas que nao sao escopadas por servidor. */
    actorDiscordId?: string;
  }
}

interface GuildParams {
  guildId: string;
}

function requireActor(request: FastifyRequest): RequestActor {
  if (!request.actor) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Requisicao sem identidade resolvida.');
  }
  return request.actor;
}

function parseId(value: string | undefined, label: string): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${label} invalido.`);
  }
  return parsed;
}

/** `?projeto=12` -> 12, `?projeto=none` -> null, ausente -> undefined. */
function parseProjectFilter(value: string | undefined): number | null | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'none' || value === 'null') return null;
  return parseId(value, 'projectId');
}

function parseItemType(value: string | undefined): ItemType {
  if (!value || !(ITEM_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError(
      `Tipo invalido. Use um de: ${ITEM_TYPES.join(', ')}.`,
    );
  }
  return value as ItemType;
}

function guildToDTO(guild: Guild): GuildDTO {
  return { id: guild.id, name: guild.name, iconUrl: guild.iconURL() };
}

/**
 * API REST somente-leitura (mais um punhado de acoes rapidas) consumida pelo
 * dashboard web. Toda rota sob `/api` exige o token de servico; toda rota com
 * `:guildId` tambem exige um ator que seja membro daquele servidor.
 */
export function createApiServer(context: AppContext, client: Client): FastifyInstance {
  const { config, logger, services, repos } = context;
  const apiLogger = logger.child({ scope: 'api' });

  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 64 * 1024,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      apiLogger.warn('Requisicao recusada', {
        method: request.method,
        url: request.url,
        code: error.code,
      });
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }

    if (isAppError(error)) {
      const status =
        error instanceof NotFoundError ? 404 : error instanceof PermissionError ? 403 : 400;
      return reply.status(status).send({ error: { code: error.code, message: error.message } });
    }

    // Detalhe tecnico so no log; o cliente recebe uma mensagem generica.
    apiLogger.error('Erro na API', { method: request.method, url: request.url, error });
    return reply.status(500).send({
      error: { code: 'INTERNAL', message: 'Erro interno. Tente novamente.' },
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Rota nao encontrada.' } }),
  );

  app.get('/health', async () => ({
    status: 'ok',
    discordReady: client.isReady(),
    guilds: client.guilds.cache.size,
  }));

  app.register(async (api) => {
    // --- autenticacao: token de servico + identidade do ator ---
    api.addHook('preHandler', async (request) => {
      const token = extractBearer(request.headers.authorization);
      if (!token || !config.apiToken || !tokensMatch(token, config.apiToken)) {
        throw new ApiError(401, 'INVALID_TOKEN', 'Token de servico invalido ou ausente.');
      }

      const actorId = request.headers['x-actor-id'];
      if (typeof actorId !== 'string' || actorId.trim().length === 0) {
        throw new ApiError(400, 'MISSING_ACTOR', 'Header X-Actor-Id ausente.');
      }

      const { guildId } = request.params as Partial<GuildParams>;
      if (guildId) {
        request.actor = await resolveActor(client, context, guildId, actorId.trim());
      } else {
        request.actorDiscordId = actorId.trim();
      }
    });

    // --- servidores visiveis para o ator ---
    api.get('/guilds', async (request) => {
      const actorId = request.actorDiscordId;
      if (!actorId) throw new ApiError(400, 'MISSING_ACTOR', 'Header X-Actor-Id ausente.');

      const guilds: GuildDTO[] = [];
      for (const guild of client.guilds.cache.values()) {
        const member = await guild.members.fetch(actorId).catch(() => null);
        if (member) guilds.push(guildToDTO(guild));
      }
      return { guilds };
    });

    api.get<{ Params: GuildParams }>('/guilds/:guildId/me', async (request) => {
      const actor = requireActor(request);
      const payload: MeDTO = {
        user: toUserDTO(actor.user),
        isAdmin: actor.isAdmin,
        guild: guildToDTO(actor.guild),
        serverTimezone: services.users.serverTimezone(actor.guild.id),
      };
      return payload;
    });

    api.get<{ Params: GuildParams }>('/guilds/:guildId/members', async (request) => {
      const actor = requireActor(request);
      return { members: services.users.listByServer(actor.guild.id).map(toUserDTO) };
    });

    // --- projetos ---
    api.get<{ Params: GuildParams; Querystring: { status?: string } }>(
      '/guilds/:guildId/projects',
      async (request) => {
        const actor = requireActor(request);
        const status = request.query.status;
        if (status && status !== 'active' && status !== 'archived') {
          throw new ValidationError('Status de projeto invalido.');
        }

        const projects = services.projects.list(actor.guild.id, status as ProjectStatus | undefined);
        return {
          projects: projects.map((project) => ({
            ...toProjectDTO(project),
            taskCounts: toTaskCounts(repos.items.countTasksByStatus(actor.guild.id, project.id)),
          })),
        };
      },
    );

    api.get<{ Params: GuildParams & { projectId: string } }>(
      '/guilds/:guildId/projects/:projectId',
      async (request) => {
        const actor = requireActor(request);
        const info = services.projects.info(
          actor.guild.id,
          parseId(request.params.projectId, 'projectId'),
        );

        const payload: ProjectDetailDTO = {
          ...toProjectDTO(info.project),
          members: services.projects.members(info.project.id).map(toUserDTO),
          taskCounts: toTaskCounts(info.taskCounts),
        };
        return payload;
      },
    );

    // --- tarefas ---
    api.get<{
      Params: GuildParams;
      Querystring: { projectId?: string; assignedTo?: string; status?: string; includeClosed?: string };
    }>('/guilds/:guildId/tasks', async (request) => {
      const actor = requireActor(request);
      const { projectId, assignedTo, status, includeClosed } = request.query;

      if (status && !isTaskStatus(status)) throw new ValidationError('Status de tarefa invalido.');

      const projectFilter = parseProjectFilter(projectId);
      const tasks = services.tasks.list({
        serverId: actor.guild.id,
        ...(projectFilter !== undefined ? { projectId: projectFilter } : {}),
        ...(assignedTo ? { assignedTo: parseId(assignedTo, 'assignedTo') } : {}),
        ...(status ? { status: status as TaskStatus } : {}),
        includeClosed: includeClosed === 'true',
      });

      return { tasks: tasks.map(toItemDTO) };
    });

    api.get<{ Params: GuildParams & { taskId: string } }>(
      '/guilds/:guildId/tasks/:taskId',
      async (request) => {
        const actor = requireActor(request);
        const task = services.tasks.detail(actor.guild.id, parseId(request.params.taskId, 'taskId'));
        return toItemDTO(task);
      },
    );

    api.post<{ Params: GuildParams & { taskId: string } }>(
      '/guilds/:guildId/tasks/:taskId/complete',
      async (request) => {
        const actor = requireActor(request);
        const task = services.tasks.complete(
          actor.guild.id,
          parseId(request.params.taskId, 'taskId'),
          actor.user,
          actor.isAdmin,
        );
        apiLogger.info('Tarefa concluida pela web', {
          guildId: actor.guild.id,
          taskId: task.id,
          userId: actor.user.discord_id,
        });
        return toItemDTO(task);
      },
    );

    api.post<{ Params: GuildParams & { taskId: string } }>(
      '/guilds/:guildId/tasks/:taskId/cancel',
      async (request) => {
        const actor = requireActor(request);
        const task = services.tasks.cancel(
          actor.guild.id,
          parseId(request.params.taskId, 'taskId'),
          actor.user,
          actor.isAdmin,
        );
        apiLogger.info('Tarefa cancelada pela web', {
          guildId: actor.guild.id,
          taskId: task.id,
          userId: actor.user.discord_id,
        });
        return toItemDTO(task);
      },
    );

    api.post<{ Params: GuildParams & { taskId: string }; Body: { status?: string } }>(
      '/guilds/:guildId/tasks/:taskId/status',
      async (request) => {
        const actor = requireActor(request);
        const status = request.body?.status;
        if (!status || !isTaskStatus(status)) throw new ValidationError('Status de tarefa invalido.');

        const task = services.tasks.edit(
          actor.guild.id,
          parseId(request.params.taskId, 'taskId'),
          { status },
          actor.user,
          actor.isAdmin,
        );
        apiLogger.info('Status de tarefa alterado pela web', {
          guildId: actor.guild.id,
          taskId: task.id,
          status,
          userId: actor.user.discord_id,
        });
        return toItemDTO(task);
      },
    );

    // --- notas, ideias, decisoes e links ---
    api.get<{ Params: GuildParams; Querystring: { type?: string; projectId?: string } }>(
      '/guilds/:guildId/items',
      async (request) => {
        const actor = requireActor(request);
        const type = parseItemType(request.query.type);
        const projectFilter = parseProjectFilter(request.query.projectId);

        if (type === 'task') throw new ValidationError('Use /tasks para listar tarefas.');

        const service =
          type === 'note'
            ? services.notes
            : type === 'idea'
              ? services.ideas
              : type === 'decision'
                ? services.decisions
                : services.links;

        return { items: service.list(actor.guild.id, projectFilter).map(toItemDTO) };
      },
    );

    api.get<{ Params: GuildParams & { itemId: string } }>(
      '/guilds/:guildId/items/:itemId',
      async (request) => {
        const actor = requireActor(request);
        const item = repos.items.findDetailedByIdInServer(
          parseId(request.params.itemId, 'itemId'),
          actor.guild.id,
        );
        if (!item) throw new NotFoundError('Registro nao encontrado neste servidor.');
        return toItemDTO(item);
      },
    );

    api.post<{ Params: GuildParams & { ideaId: string }; Body: { status?: string } }>(
      '/guilds/:guildId/ideas/:ideaId/status',
      async (request) => {
        const actor = requireActor(request);
        const status = request.body?.status;
        if (!status || !isIdeaStatus(status)) throw new ValidationError('Status de ideia invalido.');

        const idea = services.ideas.setStatus(
          actor.guild.id,
          parseId(request.params.ideaId, 'ideaId'),
          status,
          actor.user,
          actor.isAdmin,
        );
        apiLogger.info('Status de ideia alterado pela web', {
          guildId: actor.guild.id,
          ideaId: idea.id,
          status,
          userId: actor.user.discord_id,
        });
        return toItemDTO(idea);
      },
    );

    // --- lembretes ---
    api.get<{ Params: GuildParams; Querystring: { scope?: string } }>(
      '/guilds/:guildId/reminders',
      async (request) => {
        const actor = requireActor(request);
        const reminders =
          request.query.scope === 'server'
            ? services.reminders.listUpcomingForServer(actor.guild.id, 50)
            : services.reminders.listUpcomingForUser(actor.guild.id, actor.user.id, 50);

        return { reminders: reminders.map(toReminderDTO) };
      },
    );

    // --- busca ---
    api.get<{ Params: GuildParams; Querystring: { q?: string; type?: string } }>(
      '/guilds/:guildId/search',
      async (request) => {
        const actor = requireActor(request);
        const term = request.query.q ?? '';
        const types = request.query.type ? [parseItemType(request.query.type)] : undefined;

        const result = services.search.search(actor.guild.id, term, types, 100);
        const payload: SearchResultDTO = {
          term: result.term,
          total: result.total,
          results: result.all.map(toItemDTO),
        };
        return payload;
      },
    );

    // --- visoes agregadas ---
    api.get<{ Params: GuildParams }>('/guilds/:guildId/overview', async (request) => {
      const actor = requireActor(request);
      const tasks = services.tasks.mine(actor.guild.id, actor.user.id, 200).map(toItemDTO);

      const inProgress = tasks.filter((task) => task.status === 'in_progress');
      const open = tasks.filter((task) => task.status !== 'in_progress');
      const byPriority = (priority: Priority): ItemDTO[] =>
        open.filter((task) => (task.priority ?? 'medium') === priority);

      const payload: OverviewDTO = {
        tasks: {
          urgent: byPriority('urgent'),
          high: byPriority('high'),
          inProgress,
          others: [...byPriority('medium'), ...byPriority('low')],
          total: tasks.length,
        },
        reminders: services.reminders
          .listUpcomingForUser(actor.guild.id, actor.user.id, 10)
          .map(toReminderDTO),
        ideas: services.ideas.latestOpen(actor.guild.id, 5).map(toItemDTO),
      };
      return payload;
    });

    api.get<{ Params: GuildParams }>('/guilds/:guildId/summary', async (request) => {
      const actor = requireActor(request);
      const guildId = actor.guild.id;

      const projects: SummaryProjectDTO[] = services.projects
        .list(guildId, 'active')
        .map((project) => ({
          project: toProjectDTO(project),
          taskCounts: toTaskCounts(repos.items.countTasksByStatus(guildId, project.id)),
        }));

      const orphanCounts = toTaskCounts(repos.items.countTasksByStatus(guildId, null));
      const hasOrphans = Object.values(orphanCounts).some((total) => total > 0);

      const payload: SummaryDTO = {
        projects,
        unassigned: hasOrphans ? { project: null, taskCounts: orphanCounts } : null,
        pendingReminders: services.reminders.countPending(guildId),
        upcomingReminders: services.reminders.listUpcomingForServer(guildId, 5).map(toReminderDTO),
        newIdeas: services.ideas.countNew(guildId),
      };
      return payload;
    });
  }, { prefix: '/api' });

  return app;
}

/**
 * Sobe a API. Sem `API_TOKEN` configurado ela nao inicia — é preferivel nao
 * expor endpoint nenhum a expor um sem autenticacao.
 */
export async function startApiServer(
  context: AppContext,
  client: Client,
): Promise<FastifyInstance | null> {
  const { config, logger } = context;

  if (!config.apiToken) {
    logger.warn('API REST desabilitada: defina API_TOKEN para habilitar o dashboard web');
    return null;
  }

  const app = createApiServer(context, client);
  await app.listen({ port: config.apiPort, host: config.apiHost });

  logger.info('API REST iniciada', { port: config.apiPort, host: config.apiHost });
  return app;
}
