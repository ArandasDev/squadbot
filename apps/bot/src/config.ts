import 'dotenv/config';
import path from 'node:path';
import type { LogLevel } from './utils/logger.js';

export interface AppConfig {
  discordToken: string;
  discordClientId: string;
  discordGuildId: string | null;
  databasePath: string;
  defaultTimezone: string;
  nodeEnv: 'development' | 'production' | 'test';
  reminderIntervalMs: number;
  logLevel: LogLevel;
  isProduction: boolean;
  /** Token compartilhado exigido pela API REST. Sem ele, a API nao sobe. */
  apiToken: string | null;
  apiPort: number;
  apiHost: string;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Variavel de ambiente obrigatoria ausente: ${name}. Copie .env.example para .env e preencha os valores.`,
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function parseTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    throw new Error(`DEFAULT_TIMEZONE invalido: "${value}". Use um identificador IANA, ex.: America/Sao_Paulo.`);
  }
}

function parseLogLevel(value: string): LogLevel {
  const allowed: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return (allowed as string[]).includes(value) ? (value as LogLevel) : 'info';
}

/**
 * Le e valida a configuracao a partir do ambiente.
 * O token nunca é logado nem exposto — apenas repassado ao client do Discord.
 */
export function loadConfig(): AppConfig {
  const nodeEnvRaw = optionalEnv('NODE_ENV', 'development');
  const nodeEnv: AppConfig['nodeEnv'] =
    nodeEnvRaw === 'production' || nodeEnvRaw === 'test' ? nodeEnvRaw : 'development';

  const databasePath = path.resolve(optionalEnv('DATABASE_PATH', './data/squadbot.db'));

  const intervalRaw = Number.parseInt(optionalEnv('REMINDER_INTERVAL_MS', '30000'), 10);
  const reminderIntervalMs = Number.isFinite(intervalRaw) && intervalRaw >= 1000 ? intervalRaw : 30000;

  // Railway (e a maioria das PaaS) injeta PORT; API_PORT e o fallback local.
  const portRaw = Number.parseInt(optionalEnv('PORT', optionalEnv('API_PORT', '3001')), 10);
  const apiPort = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 3001;

  return {
    discordToken: requireEnv('DISCORD_TOKEN'),
    discordClientId: requireEnv('DISCORD_CLIENT_ID'),
    discordGuildId: process.env.DISCORD_GUILD_ID?.trim() || null,
    databasePath,
    defaultTimezone: parseTimezone(optionalEnv('DEFAULT_TIMEZONE', 'America/Sao_Paulo')),
    nodeEnv,
    reminderIntervalMs,
    logLevel: parseLogLevel(optionalEnv('LOG_LEVEL', 'info')),
    isProduction: nodeEnv === 'production',
    apiToken: process.env.API_TOKEN?.trim() || null,
    apiPort,
    apiHost: optionalEnv('API_HOST', '0.0.0.0'),
  };
}
