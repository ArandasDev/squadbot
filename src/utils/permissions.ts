import { PermissionFlagsBits, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import { PermissionError } from './errors.js';
import type { ItemRow, ProjectRow, UserRow } from '../types/index.js';

/**
 * Modelo de permissoes do SquadBot (deliberadamente simples):
 *
 * - Administrador: membro com `Administrator` ou `ManageGuild` no servidor.
 *   Pode gerenciar projetos e membros, excluir qualquer registro e configurar o bot.
 * - Membro: qualquer pessoa do servidor. Pode criar registros, editar os proprios
 *   e gerenciar o que estiver atribuido a ele.
 */

export function isAdminMember(member: GuildMember | null): boolean {
  if (!member) return false;
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

export function isAdminInteraction(interaction: ChatInputCommandInteraction): boolean {
  const permissions = interaction.memberPermissions;
  if (!permissions) return false;
  return (
    permissions.has(PermissionFlagsBits.Administrator) ||
    permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

/** O autor do registro ou um administrador podem alterar/excluir. */
export function canManageItem(item: ItemRow, actor: UserRow, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (item.created_by === actor.id) return true;
  // Responsavel pode mexer na propria tarefa (concluir, cancelar, editar prazo).
  return item.type === 'task' && item.assigned_to === actor.id;
}

export function assertCanManageItem(item: ItemRow, actor: UserRow, isAdmin: boolean): void {
  if (!canManageItem(item, actor, isAdmin)) {
    throw new PermissionError(
      'Voce so pode alterar registros criados por voce ou atribuidos a voce. Peca a um administrador se precisar alterar este.',
    );
  }
}

/** Projetos sao geridos por administradores ou por quem criou o projeto. */
export function canManageProject(project: ProjectRow, actor: UserRow, isAdmin: boolean): boolean {
  return isAdmin || project.created_by === actor.id;
}

export function assertCanManageProject(
  project: ProjectRow,
  actor: UserRow,
  isAdmin: boolean,
): void {
  if (!canManageProject(project, actor, isAdmin)) {
    throw new PermissionError(
      'Apenas administradores ou quem criou o projeto podem gerencia-lo.',
    );
  }
}

export function assertIsAdmin(isAdmin: boolean, action = 'executar essa acao'): void {
  if (!isAdmin) {
    throw new PermissionError(`Apenas administradores do servidor podem ${action}.`);
  }
}
