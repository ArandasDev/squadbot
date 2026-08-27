import type { DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

/**
 * O SquadBot identifica pessoas pelo id do Discord — é a mesma chave usada em
 * `users.discord_id` no banco. Guardamos esse id na sessao para poder enviar o
 * header `X-Actor-Id` nas chamadas a API do bot.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      discordId: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    discordId?: string;
  }
}

// Mantem o import de JWT em uso para que a ampliacao do modulo seja aplicada.
export type { JWT };
