'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiRequestError, NotAuthenticatedError } from '@/lib/api/client';
import type { TaskStatus } from '@/lib/api/types';

/**
 * Acoes rapidas do dashboard.
 *
 * A permissao NAO é decidida aqui: quem valida é a API do bot, com as mesmas
 * regras dos slash commands. Este arquivo apenas traduz a resposta em algo que
 * a interface consegue mostrar.
 */

export type ActionResult = { ok: boolean; message: string };

function toResult(error: unknown, fallback: string): ActionResult {
  if (error instanceof NotAuthenticatedError) {
    return { ok: false, message: 'Sua sessão expirou. Entre novamente.' };
  }
  if (error instanceof ApiRequestError) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: fallback };
}

function refresh(guildId: string): void {
  // 'layout' invalida todas as rotas sob /g/[guildId] de uma vez — contadores
  // do resumo e listas ficam coerentes depois da acao.
  revalidatePath(`/g/${guildId}`, 'layout');
}

export async function completeTaskAction(guildId: string, taskId: number): Promise<ActionResult> {
  try {
    const task = await api.completeTask(guildId, taskId);
    refresh(guildId);
    return { ok: true, message: `“${task.title}” concluída.` };
  } catch (error) {
    return toResult(error, 'Não foi possível concluir a tarefa.');
  }
}

export async function cancelTaskAction(guildId: string, taskId: number): Promise<ActionResult> {
  try {
    const task = await api.cancelTask(guildId, taskId);
    refresh(guildId);
    return { ok: true, message: `“${task.title}” cancelada.` };
  } catch (error) {
    return toResult(error, 'Não foi possível cancelar a tarefa.');
  }
}

export async function setTaskStatusAction(
  guildId: string,
  taskId: number,
  status: TaskStatus,
): Promise<ActionResult> {
  try {
    const task = await api.setTaskStatus(guildId, taskId, status);
    refresh(guildId);
    return { ok: true, message: `“${task.title}” atualizada.` };
  } catch (error) {
    return toResult(error, 'Não foi possível atualizar a tarefa.');
  }
}

export async function setIdeaStatusAction(
  guildId: string,
  ideaId: number,
  status: string,
): Promise<ActionResult> {
  try {
    const idea = await api.setIdeaStatus(guildId, ideaId, status);
    refresh(guildId);
    return { ok: true, message: `“${idea.title}” atualizada.` };
  } catch (error) {
    return toResult(error, 'Não foi possível atualizar a ideia.');
  }
}
