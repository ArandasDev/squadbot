import 'server-only';
import { auth } from '@/auth';
import type {
  GuildDTO,
  ItemDTO,
  ItemType,
  MeDTO,
  OverviewDTO,
  ProjectDetailDTO,
  ProjectStatus,
  ProjectWithCountsDTO,
  ReminderDTO,
  SearchResultDTO,
  SummaryDTO,
  TaskStatus,
  UserDTO,
} from './types';

/**
 * Cliente da API do bot.
 *
 * `server-only`: este modulo jamais entra no bundle do navegador. O token de
 * servico (`SQUADBOT_API_TOKEN`) so existe no servidor do Next — o browser
 * conversa com o Next, e o Next conversa com o bot.
 */

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * O bot nao respondeu: DNS, porta, host errado ou processo fora do ar.
 * E diferente de ter respondido com erro — por isso tem tipo proprio.
 */
export class ApiUnreachableError extends Error {
  constructor(
    public readonly url: string,
    public readonly reason: string,
  ) {
    super(`Nao foi possivel alcancar a API do bot em ${url}: ${reason}`);
    this.name = 'ApiUnreachableError';
  }
}

/** Erro lancado quando nao ha sessao — as paginas convertem em redirect. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('Sessao ausente ou expirada.');
    this.name = 'NotAuthenticatedError';
  }
}

function baseUrl(): string {
  const raw = process.env.SQUADBOT_API_URL?.trim();
  if (!raw) {
    throw new Error('SQUADBOT_API_URL nao configurada. Aponte para a API do bot.');
  }

  const url = raw.replace(/\/+$/, '');

  // Sem esquema, o fetch estoura um generico "fetch failed" e a causa real
  // (faltou o http://) fica invisivel. Melhor recusar dizendo o que falta.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `SQUADBOT_API_URL invalida: "${url}". Faltou o esquema? Use algo como http://bot.railway.internal:8080`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `SQUADBOT_API_URL precisa comecar com http:// ou https://, e nao "${parsed.protocol}".`,
    );
  }

  return url;
}

function serviceToken(): string {
  const token = process.env.SQUADBOT_API_TOKEN;
  if (!token) {
    throw new Error('SQUADBOT_API_TOKEN nao configurado. Use o mesmo valor de API_TOKEN no bot.');
  }
  return token;
}

/** Id do Discord de quem esta logado — vira o header `X-Actor-Id`. */
export async function currentActorId(): Promise<string> {
  const session = await auth();
  const discordId = session?.user?.discordId;
  if (!discordId) throw new NotAuthenticatedError();
  return discordId;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Segundos de cache. `0` (padrao) sempre busca dados frescos. */
  revalidate?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const actorId = await currentActorId();
  const { method = 'GET', body, revalidate = 0 } = options;

  const url = `${baseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${serviceToken()}`,
        'x-actor-id': actorId,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      ...(revalidate > 0 ? { next: { revalidate } } : { cache: 'no-store' }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // Vai para o log do servidor do Next — invisivel para o navegador.
    console.error('[squadbot-api] falha de rede', { url, reason });
    throw new ApiUnreachableError(baseUrl(), reason);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    console.error('[squadbot-api] resposta de erro', {
      url,
      status: response.status,
      code: payload?.error?.code,
    });
    throw new ApiRequestError(
      response.status,
      payload?.error?.code ?? 'UNKNOWN',
      payload?.error?.message ?? 'Nao foi possivel falar com o SquadBot.',
    );
  }

  return (await response.json()) as T;
}

const guild = (guildId: string) => `/api/guilds/${encodeURIComponent(guildId)}`;

export const api = {
  /** Servidores em que o bot esta E o usuario logado é membro. */
  async guilds(): Promise<GuildDTO[]> {
    const data = await request<{ guilds: GuildDTO[] }>('/api/guilds');
    return data.guilds;
  },

  me(guildId: string): Promise<MeDTO> {
    return request<MeDTO>(`${guild(guildId)}/me`);
  },

  async members(guildId: string): Promise<UserDTO[]> {
    const data = await request<{ members: UserDTO[] }>(`${guild(guildId)}/members`);
    return data.members;
  },

  async projects(guildId: string, status?: ProjectStatus): Promise<ProjectWithCountsDTO[]> {
    const query = status ? `?status=${status}` : '';
    const data = await request<{ projects: ProjectWithCountsDTO[] }>(
      `${guild(guildId)}/projects${query}`,
    );
    return data.projects;
  },

  project(guildId: string, projectId: number): Promise<ProjectDetailDTO> {
    return request<ProjectDetailDTO>(`${guild(guildId)}/projects/${projectId}`);
  },

  async tasks(
    guildId: string,
    filters: {
      projectId?: string;
      assignedTo?: string;
      status?: TaskStatus;
      includeClosed?: boolean;
    } = {},
  ): Promise<ItemDTO[]> {
    const params = new URLSearchParams();
    if (filters.projectId) params.set('projectId', filters.projectId);
    if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
    if (filters.status) params.set('status', filters.status);
    if (filters.includeClosed) params.set('includeClosed', 'true');

    const query = params.size > 0 ? `?${params.toString()}` : '';
    const data = await request<{ tasks: ItemDTO[] }>(`${guild(guildId)}/tasks${query}`);
    return data.tasks;
  },

  async items(guildId: string, type: ItemType, projectId?: string): Promise<ItemDTO[]> {
    const params = new URLSearchParams({ type });
    if (projectId) params.set('projectId', projectId);
    const data = await request<{ items: ItemDTO[] }>(
      `${guild(guildId)}/items?${params.toString()}`,
    );
    return data.items;
  },

  item(guildId: string, itemId: number): Promise<ItemDTO> {
    return request<ItemDTO>(`${guild(guildId)}/items/${itemId}`);
  },

  async reminders(guildId: string, scope: 'me' | 'server' = 'me'): Promise<ReminderDTO[]> {
    const data = await request<{ reminders: ReminderDTO[] }>(
      `${guild(guildId)}/reminders?scope=${scope}`,
    );
    return data.reminders;
  },

  search(guildId: string, term: string, type?: ItemType): Promise<SearchResultDTO> {
    const params = new URLSearchParams({ q: term });
    if (type) params.set('type', type);
    return request<SearchResultDTO>(`${guild(guildId)}/search?${params.toString()}`);
  },

  overview(guildId: string): Promise<OverviewDTO> {
    return request<OverviewDTO>(`${guild(guildId)}/overview`);
  },

  summary(guildId: string): Promise<SummaryDTO> {
    return request<SummaryDTO>(`${guild(guildId)}/summary`);
  },

  completeTask(guildId: string, taskId: number): Promise<ItemDTO> {
    return request<ItemDTO>(`${guild(guildId)}/tasks/${taskId}/complete`, { method: 'POST' });
  },

  cancelTask(guildId: string, taskId: number): Promise<ItemDTO> {
    return request<ItemDTO>(`${guild(guildId)}/tasks/${taskId}/cancel`, { method: 'POST' });
  },

  setTaskStatus(guildId: string, taskId: number, status: TaskStatus): Promise<ItemDTO> {
    return request<ItemDTO>(`${guild(guildId)}/tasks/${taskId}/status`, {
      method: 'POST',
      body: { status },
    });
  },

  setIdeaStatus(guildId: string, ideaId: number, status: string): Promise<ItemDTO> {
    return request<ItemDTO>(`${guild(guildId)}/ideas/${ideaId}/status`, {
      method: 'POST',
      body: { status },
    });
  },
};
