import { Client, GatewayIntentBits, Options, Partials } from 'discord.js';

/**
 * Cliente do Discord.
 *
 * Usamos apenas o intent `Guilds` — o SquadBot nao le mensagens do chat, so
 * responde a interacoes (slash commands). Isso dispensa intents privilegiados
 * no Developer Portal e mantem o bot verificavel sem revisao.
 *
 * `Partials.Channel` é necessario para enviar DMs de lembrete a usuarios com
 * quem o bot ainda nao tem canal direto aberto.
 */
export function createClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel],
    // O squad é pequeno; caches enxutos mantem o consumo de memoria baixo.
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 0,
      PresenceManager: 0,
      ReactionManager: 0,
    }),
  });
}
