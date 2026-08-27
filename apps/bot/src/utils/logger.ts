/**
 * Logger estruturado minimalista (sem dependencias externas).
 *
 * Em producao emite uma linha JSON por evento — facil de consumir em Railway,
 * Docker ou qualquer coletor de logs. Em desenvolvimento emite texto legivel.
 *
 * NUNCA registre tokens ou dados sensiveis: o campo `redact` remove chaves
 * conhecidamente sensiveis antes de serializar.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEYS = new Set([
  'token',
  'discord_token',
  'discordtoken',
  'authorization',
  'password',
  'secret',
  'apikey',
  'api_key',
]);

export interface LoggerOptions {
  level: LogLevel;
  pretty: boolean;
  /** Silencia completamente a saida — usado nos testes. */
  silent?: boolean;
}

function redact(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
      continue;
    }
    if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message, stack: value.stack };
      continue;
    }
    out[key] = value;
  }
  return out;
}

export class Logger {
  private readonly level: LogLevel;
  private readonly pretty: boolean;
  private readonly silent: boolean;
  private readonly base: Record<string, unknown>;

  constructor(options: LoggerOptions, base: Record<string, unknown> = {}) {
    this.level = options.level;
    this.pretty = options.pretty;
    this.silent = options.silent ?? false;
    this.base = base;
  }

  /** Cria um logger filho com contexto fixo (ex.: `{ scope: 'ReminderWorker' }`). */
  child(context: Record<string, unknown>): Logger {
    return new Logger(
      { level: this.level, pretty: this.pretty, silent: this.silent },
      { ...this.base, ...context },
    );
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta: Record<string, unknown>): void {
    if (this.silent) return;
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) return;

    const payload = redact({ ...this.base, ...meta });
    const timestamp = new Date().toISOString();

    if (this.pretty) {
      const extra = Object.keys(payload).length > 0 ? ` ${JSON.stringify(payload)}` : '';
      const line = `${timestamp} ${level.toUpperCase().padEnd(5)} ${message}${extra}`;
      if (level === 'error') console.error(line);
      else if (level === 'warn') console.warn(line);
      else console.log(line);
      return;
    }

    const line = JSON.stringify({ timestamp, level, message, ...payload });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
