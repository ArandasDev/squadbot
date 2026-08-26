import { EmbedBuilder, type Client } from 'discord.js';
import type { AppContext } from '../services/index.js';
import type { ReminderWithTargets } from '../database/repositories/index.js';
import { COLORS, escapeMarkdown, mentionUser } from '../utils/formatting.js';
import { discordTimestamp, formatDateTime, nowIso } from '../utils/dates.js';

/**
 * Canal de entrega do lembrete. A abstracao existe para que o worker seja
 * testavel sem uma conexao real com o Discord.
 */
export interface ReminderDelivery {
  deliver(reminder: ReminderWithTargets): Promise<void>;
}

/** Entrega real: DM para o destinatario. */
export class DiscordReminderDelivery implements ReminderDelivery {
  constructor(private readonly client: Client) {}

  async deliver(reminder: ReminderWithTargets): Promise<void> {
    const user = await this.client.users.fetch(reminder.recipient_discord_id);

    const remindAt = new Date(reminder.remind_at);
    const embed = new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle('⏰ Lembrete')
      .setDescription(escapeMarkdown(reminder.message))
      .setFooter({
        text: `Agendado para ${formatDateTime(remindAt, reminder.recipient_timezone)} (${reminder.recipient_timezone})`,
      });

    if (reminder.item_title) {
      embed.addFields({ name: 'Tarefa relacionada', value: escapeMarkdown(reminder.item_title) });
    }

    // Deixa claro quando outra pessoa criou o lembrete para voce.
    const content =
      reminder.created_by === reminder.recipient_id
        ? undefined
        : `Lembrete criado por ${mentionUser(reminder.creator_discord_id)} · ${discordTimestamp(remindAt, 'R')}`;

    await user.send(content ? { content, embeds: [embed] } : { embeds: [embed] });
  }
}

export interface ReminderWorkerOptions {
  intervalMs?: number;
  batchSize?: number;
  /** Tentativas de entrega antes de desistir de um lembrete. */
  maxAttempts?: number;
}

export interface TickResult {
  processed: number;
  sent: number;
  failed: number;
  abandoned: number;
}

/**
 * Worker de lembretes.
 *
 * A cada ciclo procura lembretes com `sent = 0` e `remind_at <= agora (UTC)`,
 * entrega e marca como enviado. Todo o estado vive no SQLite: reiniciar o
 * processo (ou o container) nao perde nem duplica lembretes — os pendentes
 * simplesmente sao encontrados de novo no proximo ciclo.
 */
export class ReminderWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  /** Tentativas por lembrete no processo atual (reiniciado a cada boot). */
  private readonly attempts = new Map<number, number>();

  constructor(
    private readonly context: AppContext,
    private readonly delivery: ReminderDelivery,
    options: ReminderWorkerOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? context.config.reminderIntervalMs;
    this.batchSize = options.batchSize ?? 50;
    this.maxAttempts = options.maxAttempts ?? 5;
  }

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    // Nao segura o event loop aberto no shutdown.
    this.timer.unref?.();

    this.context.logger.info('Reminder worker iniciado', { intervalMs: this.intervalMs });

    // Primeiro ciclo imediato: lembretes vencidos enquanto o bot estava fora
    // sao entregues assim que ele volta.
    void this.tick();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.context.logger.info('Reminder worker parado');
  }

  /**
   * Executa um ciclo. Exposto publicamente para os testes — e para permitir um
   * disparo manual sem esperar o intervalo.
   */
  async tick(now = new Date()): Promise<TickResult> {
    // Um ciclo lento nunca deve se sobrepor ao seguinte.
    if (this.running) return { processed: 0, sent: 0, failed: 0, abandoned: 0 };
    this.running = true;

    const result: TickResult = { processed: 0, sent: 0, failed: 0, abandoned: 0 };

    try {
      const due = this.context.services.reminders.due(now.toISOString(), this.batchSize);
      result.processed = due.length;

      for (const reminder of due) {
        try {
          await this.delivery.deliver(reminder);

          // `markSent` só altera linhas com `sent = 0`, entao é idempotente.
          this.context.services.reminders.markSent(reminder.id, nowIso());
          this.attempts.delete(reminder.id);
          result.sent += 1;

          this.context.logger.info('Lembrete enviado', {
            reminderId: reminder.id,
            guildId: reminder.server_id,
            recipientId: reminder.recipient_discord_id,
            createdForOther: reminder.created_by !== reminder.recipient_id,
          });
        } catch (error) {
          const attempts = (this.attempts.get(reminder.id) ?? 0) + 1;
          this.attempts.set(reminder.id, attempts);
          result.failed += 1;

          this.context.logger.error('Erro ao enviar lembrete', {
            reminderId: reminder.id,
            guildId: reminder.server_id,
            recipientId: reminder.recipient_discord_id,
            attempts,
            error,
          });

          // Depois de N falhas (DM bloqueada, usuario saiu do servidor, etc.)
          // paramos de tentar para nao repetir o erro a cada 30 segundos.
          if (attempts >= this.maxAttempts) {
            this.context.services.reminders.markSent(reminder.id, nowIso());
            this.attempts.delete(reminder.id);
            result.abandoned += 1;
            this.context.logger.warn('Lembrete descartado apos falhas consecutivas', {
              reminderId: reminder.id,
              attempts,
            });
          }
        }
      }
    } catch (error) {
      this.context.logger.error('Falha no ciclo do reminder worker', { error });
    } finally {
      this.running = false;
    }

    return result;
  }
}
