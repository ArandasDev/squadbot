import 'server-only';
import { api } from './client';

/** Mapa `users.id` -> username, para exibir responsáveis sem N+1 na interface. */
export async function usernamesByUserId(guildId: string): Promise<Record<number, string>> {
  const members = await api.members(guildId);
  return Object.fromEntries(members.map((member) => [member.id, member.username]));
}
