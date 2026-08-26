import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, makeUser, SERVER_A, SERVER_B } from './helpers.js';
import type { AppContext } from '../src/services/index.js';
import type { ReminderWithTargets } from '../src/database/repositories/index.js';
import { ReminderWorker, type ReminderDelivery } from '../src/workers/ReminderWorker.js';
import { PermissionError, ValidationError } from '../src/utils/errors.js';

/** Canal de entrega falso: registra o que seria enviado. */
class FakeDelivery implements ReminderDelivery {
  public readonly delivered: ReminderWithTargets[] = [];
  public failUntil = 0;
  private failures = 0;

  async deliver(reminder: ReminderWithTargets): Promise<void> {
    if (this.failures < this.failUntil) {
      this.failures += 1;
      throw new Error('DM bloqueada');
    }
    this.delivered.push(reminder);
  }
}

describe('ReminderService', () => {
  let context: AppContext;
  const reference = new Date('2026-08-26T12:00:00.000Z');

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    context.db.close();
  });

  it('cria um lembrete para si mesmo', () => {
    const joao = makeUser(context, SERVER_A, 'joao');

    const { reminder, remindAt } = context.services.reminders.create({
      serverId: SERVER_A,
      actor: joao,
      recipient: joao,
      whenInput: 'amanha 10:00',
      message: 'Fazer deploy',
      reference,
    });

    expect(reminder.created_by).toBe(joao.id);
    expect(reminder.recipient_id).toBe(joao.id);
    expect(reminder.sent).toBe(0);
    expect(reminder.message).toBe('Fazer deploy');
    // America/Sao_Paulo (UTC-3): 27/08 10:00 local = 13:00 UTC.
    expect(remindAt.toISOString()).toBe('2026-08-27T13:00:00.000Z');
    expect(reminder.remind_at).toBe('2026-08-27T13:00:00.000Z');
  });

  it('cria um lembrete para outra pessoa mantendo created_by e recipient_id distintos', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');

    const { reminder } = context.services.reminders.create({
      serverId: SERVER_A,
      actor: joao,
      recipient: maria,
      whenInput: 'amanha 09:00',
      message: 'Revisar o PR do backend',
      reference,
    });

    expect(reminder.created_by).toBe(joao.id);
    expect(reminder.recipient_id).toBe(maria.id);
    expect(reminder.created_by).not.toBe(reminder.recipient_id);

    // O lembrete aparece para Maria, nao para Joao.
    expect(context.services.reminders.listUpcomingForUser(SERVER_A, maria.id)).toHaveLength(1);
    expect(context.services.reminders.listUpcomingForUser(SERVER_A, joao.id)).toHaveLength(0);
  });

  it('nao permite lembrete para usuario de outro servidor', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const forasteiro = makeUser(context, SERVER_B, 'forasteiro');

    expect(() =>
      context.services.reminders.create({
        serverId: SERVER_A,
        actor: joao,
        recipient: forasteiro,
        whenInput: 'amanha 09:00',
        message: 'Nao deveria chegar',
        reference,
      }),
    ).toThrow(PermissionError);
  });

  it('recusa datas no passado e formatos que nao entende', () => {
    const joao = makeUser(context, SERVER_A, 'joao');

    expect(() =>
      context.services.reminders.create({
        serverId: SERVER_A,
        actor: joao,
        recipient: joao,
        whenInput: '2020-01-01 09:00',
        message: 'Passado',
        reference,
      }),
    ).toThrow(ValidationError);

    expect(() =>
      context.services.reminders.create({
        serverId: SERVER_A,
        actor: joao,
        recipient: joao,
        whenInput: 'quando der',
        message: 'Vago',
        reference,
      }),
    ).toThrow(ValidationError);
  });

  it('interpreta a data no fuso de quem cria o lembrete', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    context.services.users.setUserTimezone(joao.id, 'Europe/Lisbon');
    const joaoLisboa = context.services.users.findById(joao.id)!;

    const { remindAt } = context.services.reminders.create({
      serverId: SERVER_A,
      actor: joaoLisboa,
      recipient: joaoLisboa,
      whenInput: 'amanha 10:00',
      message: 'Daily',
      reference,
    });

    // Lisboa em agosto esta em UTC+1: 10:00 local = 09:00 UTC.
    expect(remindAt.toISOString()).toBe('2026-08-27T09:00:00.000Z');
  });

  it('deixa o criador e o destinatario cancelarem, mas nao um terceiro', () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const carlos = makeUser(context, SERVER_A, 'carlos');

    const { reminder } = context.services.reminders.create({
      serverId: SERVER_A,
      actor: joao,
      recipient: maria,
      whenInput: '2h',
      message: 'Call de alinhamento',
      reference,
    });

    expect(() => context.services.reminders.cancel(SERVER_A, reminder.id, carlos, false)).toThrow(
      PermissionError,
    );

    context.services.reminders.cancel(SERVER_A, reminder.id, maria, false);
    expect(context.repos.reminders.findById(reminder.id)).toBeUndefined();
  });
});

describe('ReminderWorker', () => {
  let context: AppContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    context.db.close();
  });

  it('processa lembretes vencidos, entrega e marca como enviado', async () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_A, 'maria');
    const reference = new Date('2026-08-26T12:00:00.000Z');

    const { reminder } = context.services.reminders.create({
      serverId: SERVER_A,
      actor: joao,
      recipient: maria,
      whenInput: '1h',
      message: 'Revisar o PR do backend',
      reference,
    });

    const delivery = new FakeDelivery();
    const worker = new ReminderWorker(context, delivery);

    // Antes do horario: nada é entregue.
    const early = await worker.tick(new Date('2026-08-26T12:30:00.000Z'));
    expect(early.processed).toBe(0);
    expect(delivery.delivered).toHaveLength(0);

    // Depois do horario: entrega e marca.
    const result = await worker.tick(new Date('2026-08-26T13:05:00.000Z'));
    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
    expect(delivery.delivered).toHaveLength(1);
    expect(delivery.delivered[0]?.recipient_discord_id).toBe(maria.discord_id);
    expect(delivery.delivered[0]?.creator_username).toBe('joao');

    const stored = context.repos.reminders.findById(reminder.id);
    expect(stored?.sent).toBe(1);
    expect(stored?.sent_at).toBeTruthy();

    // Um segundo ciclo nao reenvia.
    const again = await worker.tick(new Date('2026-08-26T13:10:00.000Z'));
    expect(again.processed).toBe(0);
    expect(delivery.delivered).toHaveLength(1);
  });

  it('entrega lembretes vencidos enquanto o bot estava offline', async () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const reference = new Date('2026-08-26T12:00:00.000Z');

    context.services.reminders.create({
      serverId: SERVER_A,
      actor: joao,
      recipient: joao,
      whenInput: '1h',
      message: 'Fazer deploy',
      reference,
    });

    // Simula a volta do bot varias horas depois: o estado veio do SQLite.
    const delivery = new FakeDelivery();
    const worker = new ReminderWorker(context, delivery);
    const result = await worker.tick(new Date('2026-08-27T08:00:00.000Z'));

    expect(result.sent).toBe(1);
    expect(delivery.delivered[0]?.message).toBe('Fazer deploy');
  });

  it('tenta novamente quando a entrega falha e desiste apos o limite', async () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const reference = new Date('2026-08-26T12:00:00.000Z');

    const { reminder } = context.services.reminders.create({
      serverId: SERVER_A,
      actor: joao,
      recipient: joao,
      whenInput: '1h',
      message: 'DM bloqueada',
      reference,
    });

    const delivery = new FakeDelivery();
    delivery.failUntil = 10;
    const worker = new ReminderWorker(context, delivery, { maxAttempts: 3 });

    const now = new Date('2026-08-26T13:05:00.000Z');
    const first = await worker.tick(now);
    expect(first.failed).toBe(1);
    expect(context.repos.reminders.findById(reminder.id)?.sent).toBe(0);

    await worker.tick(now);
    const third = await worker.tick(now);

    expect(third.abandoned).toBe(1);
    expect(context.repos.reminders.findById(reminder.id)?.sent).toBe(1);
    expect(delivery.delivered).toHaveLength(0);
  });

  it('nao mistura lembretes de servidores diferentes na entrega', async () => {
    const joao = makeUser(context, SERVER_A, 'joao');
    const maria = makeUser(context, SERVER_B, 'maria');
    const reference = new Date('2026-08-26T12:00:00.000Z');

    context.services.reminders.create({
      serverId: SERVER_A,
      actor: joao,
      recipient: joao,
      whenInput: '1h',
      message: 'Lembrete do servidor A',
      reference,
    });
    context.services.reminders.create({
      serverId: SERVER_B,
      actor: maria,
      recipient: maria,
      whenInput: '1h',
      message: 'Lembrete do servidor B',
      reference,
    });

    const delivery = new FakeDelivery();
    const worker = new ReminderWorker(context, delivery);
    await worker.tick(new Date('2026-08-26T13:05:00.000Z'));

    const byServer = new Map(delivery.delivered.map((r) => [r.server_id, r.recipient_discord_id]));
    expect(byServer.get(SERVER_A)).toBe(joao.discord_id);
    expect(byServer.get(SERVER_B)).toBe(maria.discord_id);
    expect(context.services.reminders.countPending(SERVER_A)).toBe(0);
    expect(context.services.reminders.countPending(SERVER_B)).toBe(0);
  });
});
