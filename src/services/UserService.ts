import type { Repositories } from '../database/repositories/index.js';
import type { UserRow } from '../types/index.js';
import { isValidTimeZone } from '../utils/dates.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export interface UserIdentity {
  discordId: string;
  username: string;
}

/**
 * Resolve e mantem os usuarios do squad.
 *
 * Todo comando comeca por `ensure()`: o SquadBot cria a linha do usuario na
 * primeira interacao dele naquele servidor, sem cadastro manual.
 */
export class UserService {
  constructor(
    private readonly repos: Repositories,
    private readonly defaultTimezone: string,
  ) {}

  /** Timezone padrao do servidor (configuravel) com fallback para o do ambiente. */
  serverTimezone(serverId: string): string {
    return this.repos.serverSettings.find(serverId)?.timezone ?? this.defaultTimezone;
  }

  ensure(serverId: string, identity: UserIdentity): UserRow {
    return this.repos.users.ensure(
      serverId,
      identity.discordId,
      identity.username,
      this.serverTimezone(serverId),
    );
  }

  findById(id: number): UserRow | undefined {
    return this.repos.users.findById(id);
  }

  findByDiscordId(serverId: string, discordId: string): UserRow | undefined {
    return this.repos.users.findByDiscordId(serverId, discordId);
  }

  listByServer(serverId: string): UserRow[] {
    return this.repos.users.listByServer(serverId);
  }

  setUserTimezone(userId: number, timezone: string): UserRow {
    if (!isValidTimeZone(timezone)) {
      throw new ValidationError(
        `Timezone invalido: \`${timezone}\`. Use um identificador IANA, por exemplo \`America/Sao_Paulo\`.`,
      );
    }
    const updated = this.repos.users.updateTimezone(userId, timezone);
    if (!updated) throw new NotFoundError('Usuario nao encontrado.');
    return updated;
  }

  setServerTimezone(serverId: string, timezone: string): string {
    if (!isValidTimeZone(timezone)) {
      throw new ValidationError(
        `Timezone invalido: \`${timezone}\`. Use um identificador IANA, por exemplo \`America/Sao_Paulo\`.`,
      );
    }
    return this.repos.serverSettings.upsertTimezone(serverId, timezone).timezone;
  }
}
