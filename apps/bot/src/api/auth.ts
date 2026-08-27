import { createHash, timingSafeEqual } from 'node:crypto';
import type { Client, Guild } from 'discord.js';
import type { AppContext } from '../services/index.js';
import type { UserRow } from '../types/index.js';
import { isAdminMember } from '../utils/permissions.js';

/**
 * A API do SquadBot tem dois niveis de confianca, e os dois precisam passar:
 *
 * 1. **Token de servico** (`Authorization: Bearer <API_TOKEN>`) — prova que quem
 *    chama é o backend do dashboard, nao um navegador qualquer. O token nunca
 *    chega ao browser: so o servidor do Next o conhece.
 *
 * 2. **Identidade do usuario** (`X-Actor-Id: <discord user id>`) — quem é a
 *    pessoa por tras da requisicao. O dashboard so preenche esse header depois
 *    do login por OAuth do Discord.
 *
 * O ator é entao resolvido contra a guild real: se nao for membro, a
 * requisicao morre aqui — mesmas regras dos slash commands.
 */

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Comparacao em tempo constante. Os valores sao normalizados por SHA-256 antes
 * para que tokens de tamanhos diferentes nao vazem informacao pelo tempo de
 * resposta nem quebrem o `timingSafeEqual`.
 */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export interface RequestActor {
  user: UserRow;
  isAdmin: boolean;
  guild: Guild;
}

/**
 * Resolve o ator da requisicao dentro da guild informada.
 *
 * Lanca `ApiError` com 403/404 quando o bot nao esta no servidor ou quando a
 * pessoa nao é membro dele — o dashboard nunca ve dados de um servidor ao qual
 * o usuario nao pertence.
 */
export async function resolveActor(
  client: Client,
  context: AppContext,
  guildId: string,
  actorDiscordId: string,
): Promise<RequestActor> {
  const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));

  if (!guild) {
    throw new ApiError(404, 'GUILD_NOT_FOUND', 'O SquadBot nao esta neste servidor.');
  }

  const member = await guild.members.fetch(actorDiscordId).catch(() => null);
  if (!member) {
    throw new ApiError(403, 'NOT_A_MEMBER', 'Voce nao é membro deste servidor.');
  }

  const user = context.services.users.ensure(guild.id, {
    discordId: member.id,
    username: member.displayName,
  });

  return { user, isAdmin: isAdminMember(member), guild };
}
