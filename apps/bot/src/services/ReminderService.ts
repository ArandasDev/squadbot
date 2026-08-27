import type { Repositories, ReminderWithTargets } from '../database/repositories/index.js';
import type { ReminderRow, UserRow } from '../types/index.js';
import { parseUserDateTime } from '../utils/dates.js';
import { NotFoundError, PermissionError, ValidationError } from '../utils/errors.js';

const MESSAGE_MAX = 1000;
/** Um lembrete precisa estar ao menos 30s no futuro para o worker conseguir entrega-lo. */
const MIN_LEAD_MS = 30_000;
/** Limite superior sanitario: 2 anos. */
const MAX_LEAD_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export interface CreateReminderInput {
  serverId: string;
  /** Quem executou o comando. */
  actor: UserRow;
  /** Quem vai RECEBER o lembrete — pode ser o proprio `actor` ou outra pessoa. */
  recipient: UserRow;
  /** Texto informado pelo usuario, interpretado no timezone de quem cria. */
  whenInput: string;
  message: string;
  itemId?: number | null;
  reference?: Date;
}

export interface CreatedReminder {
  reminder: ReminderRow;
  remindAt: Date;
  /** Timezone usado para interpretar a entrada (o de quem criou). */
  interpretedIn: string;
}

/**
 * Lembretes do SquadBot.
 *
 * Regra fundamental: quem CRIA nao precisa ser quem RECEBE.
 *   `created_by`   = autor do comando
 *   `recipient_id` = destinatario
 *
 * O destinatario precisa obrigatoriamente pertencer ao mesmo servidor — quem
 * chama garante isso resolvendo o membro na guild antes de chegar aqui, e este
 * service reforca a checagem comparando o `server_id` da linha do usuario.
 */
export class ReminderService {
  constructor(private readonly repos: Repositories) {}

  create(input: CreateReminderInput): CreatedReminder {
    const message = input.message.trim();
    if (message.length < 2) throw new ValidationError('A mensagem do lembrete precisa ter pelo menos 2 caracteres.');
    if (message.length > MESSAGE_MAX) {
      throw new ValidationError(`A mensagem deve ter no maximo ${MESSAGE_MAX} caracteres.`);
    }

    // Isolamento entre servidores: destinatario e autor precisam ser do mesmo servidor.
    if (input.recipient.server_id !== input.serverId || input.actor.server_id !== input.serverId) {
      throw new PermissionError(
        'So é possivel criar lembretes para membros deste servidor.',
      );
    }

    const reference = input.reference ?? new Date();
    const remindAt = parseUserDateTime(input.whenInput, input.actor.timezone, reference);
    if (!remindAt) {
      throw new ValidationError(
        [
          `Nao entendi a data \`${input.whenInput}\`.`,
          '',
          'Formatos aceitos:',
          '`amanha 09:00` · `hoje 18:00` · `segunda 14:00`',
          '`2026-08-28 09:00` · `28/08 09:00` · `30m` · `2h` · `3d`',
        ].join('\n'),
      );
    }

    const delta = remindAt.getTime() - reference.getTime();
    if (delta < MIN_LEAD_MS) {
      throw new ValidationError('O lembrete precisa ser para pelo menos 30 segundos no futuro.');
    }
    if (delta > MAX_LEAD_MS) {
      throw new ValidationError('O lembrete nao pode ser agendado para mais de 2 anos no futuro.');
    }

    const itemId = this.normalizeItemId(input.serverId, input.itemId);

    const reminder = this.repos.reminders.create({
      serverId: input.serverId,
      createdBy: input.actor.id,
      recipientId: input.recipient.id,
      itemId,
      message,
      remindAt: remindAt.toISOString(),
    });

    return { reminder, remindAt, interpretedIn: input.actor.timezone };
  }

  listUpcomingForUser(serverId: string, userId: number, limit = 10): ReminderWithTargets[] {
    return this.repos.reminders.listUpcomingForUser(serverId, userId, limit);
  }

  listUpcomingForServer(serverId: string, limit = 25): ReminderWithTargets[] {
    return this.repos.reminders.listUpcomingForServer(serverId, limit);
  }

  /** Sugestoes para o autocomplete de `/lembrete cancelar`. */
  autocompleteCancellable(
    serverId: string,
    userId: number,
    term: string,
  ): { name: string; value: number }[] {
    return this.repos.reminders
      .listCancellableForUser(serverId, userId, term)
      .map((reminder) => ({
        name: `#${reminder.id} · ${reminder.message}`.slice(0, 100),
        value: reminder.id,
      }));
  }

  countPending(serverId: string): number {
    return this.repos.reminders.countPendingForServer(serverId);
  }

  /** Lembretes vencidos e nao enviados — consumido pelo `ReminderWorker`. */
  due(nowUtcIso: string, limit = 50): ReminderWithTargets[] {
    return this.repos.reminders.listDue(nowUtcIso, limit);
  }

  markSent(id: number, sentAtIso?: string): boolean {
    return this.repos.reminders.markSent(id, sentAtIso);
  }

  /** Podem cancelar: quem criou, quem receberia, ou um administrador. */
  cancel(serverId: string, reminderId: number, actor: UserRow, isAdmin: boolean): ReminderRow {
    const reminder = this.repos.reminders.findByIdInServer(reminderId, serverId);
    if (!reminder) throw new NotFoundError(`Lembrete \`#${reminderId}\` nao encontrado neste servidor.`);
    if (reminder.sent === 1) throw new ValidationError('Esse lembrete ja foi enviado.');

    const allowed = isAdmin || reminder.created_by === actor.id || reminder.recipient_id === actor.id;
    if (!allowed) {
      throw new PermissionError('Voce so pode cancelar lembretes criados por voce ou destinados a voce.');
    }

    this.repos.reminders.remove(reminder.id);
    return reminder;
  }

  private normalizeItemId(serverId: string, itemId: number | null | undefined): number | null {
    if (itemId === null || itemId === undefined) return null;
    const item = this.repos.items.findByIdInServer(itemId, serverId);
    if (!item) throw new NotFoundError('Item vinculado nao encontrado neste servidor.');
    return item.id;
  }
}
