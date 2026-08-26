/**
 * Utilitarios de data/hora com suporte a timezone, sem dependencias externas
 * (Node 24 ja embarca ICU completo, entao `Intl` resolve as conversoes).
 *
 * Contrato do projeto:
 * - persistencia sempre em UTC ISO 8601 (`toIso`);
 * - interpretacao da entrada do usuario acontece no timezone DELE (`parseUserDateTime`);
 * - exibicao acontece no timezone do usuario (`formatInTimeZone`).
 */

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function toIso(date: Date): string {
  return date.toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  partsFormatterCache.set(timeZone, formatter);
  return formatter;
}

/** Decompoe um instante nos componentes de calendario do timezone informado. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = Number.parseInt(part.value, 10);
  }
  return {
    year: values.year ?? 1970,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Offset do timezone (em ms) para um instante especifico — respeita horario de verao. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

/**
 * Converte uma data/hora "de parede" (como o usuario digitou) do timezone dele
 * para o instante UTC correspondente. A dupla iteracao resolve as bordas de DST.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let timestamp = naive - timeZoneOffsetMs(new Date(naive), timeZone);
  timestamp = naive - timeZoneOffsetMs(new Date(timestamp), timeZone);
  return new Date(timestamp);
}

export function formatInTimeZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hourCycle: 'h23',
    ...options,
  }).format(date);
}

/** `28/08/2026 09:00` */
export function formatDateTime(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `28/08/2026` */
export function formatDate(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** `09:00` */
export function formatTime(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Rotulo curto e humano: `Hoje 18:00`, `Amanha 09:00`, `28/08 14:30`.
 */
export function formatRelativeLabel(date: Date, timeZone: string, reference = new Date()): string {
  const target = getZonedParts(date, timeZone);
  const today = getZonedParts(reference, timeZone);

  const targetDayNumber = Date.UTC(target.year, target.month - 1, target.day);
  const todayDayNumber = Date.UTC(today.year, today.month - 1, today.day);
  const diffDays = Math.round((targetDayNumber - todayDayNumber) / DAY);

  const time = formatTime(date, timeZone);
  if (diffDays === 0) return `Hoje ${time}`;
  if (diffDays === 1) return `Amanha ${time}`;
  if (diffDays === -1) return `Ontem ${time}`;

  const sameYear = target.year === today.year;
  const datePart = formatInTimeZone(date, timeZone, {
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${datePart} ${time}`;
}

/** Timestamp dinamico do Discord (`<t:1234567890:f>`), renderizado no fuso de quem le. */
export function discordTimestamp(date: Date, style: 'f' | 'F' | 'R' | 'd' | 't' = 'f'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  'terca-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
};

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(value: string): string {
  return stripAccents(value.trim().toLowerCase()).replace(/\s+/g, ' ');
}

function parseClock(value: string | undefined): { hour: number; minute: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2})(?:[:h](\d{2}))?h?$/.exec(value);
  if (!match) return null;
  const hour = Number.parseInt(match[1] ?? '', 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function addDaysZoned(
  parts: ZonedParts,
  days: number,
): { year: number; month: number; day: number } {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + days);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

/**
 * Interpreta a data informada pelo usuario, no timezone dele.
 *
 * Formatos aceitos:
 *   agora
 *   30m | 2h | 3d | em 45 minutos | em 2 horas | em 3 dias
 *   18:00                    (hoje, ou amanha se ja passou)
 *   hoje 18:00 | amanha 09:00 | depois de amanha 09:00
 *   segunda 09:00            (proxima ocorrencia do dia da semana)
 *   2026-08-28 [14:30]
 *   28/08 [14:30] | 28/08/2026 [14:30]
 *
 * Retorna `null` quando nao consegue interpretar — quem chama decide a mensagem de erro.
 */
export function parseUserDateTime(
  input: string,
  timeZone: string,
  reference = new Date(),
): Date | null {
  const raw = normalize(input);
  if (!raw) return null;

  if (raw === 'agora') return new Date(reference.getTime());

  // Duracoes relativas: "30m", "2h", "3d", "em 45 minutos"
  const relative =
    /^(?:em\s+)?(\d{1,4})\s*(m|min|mins|minuto|minutos|h|hora|horas|d|dia|dias|semana|semanas)$/.exec(
      raw,
    );
  if (relative) {
    const amount = Number.parseInt(relative[1] ?? '', 10);
    const unit = relative[2] ?? '';
    let ms = 0;
    if (unit.startsWith('m')) ms = amount * MINUTE;
    else if (unit.startsWith('h')) ms = amount * HOUR;
    else if (unit.startsWith('d')) ms = amount * DAY;
    else ms = amount * 7 * DAY;
    return new Date(reference.getTime() + ms);
  }

  const today = getZonedParts(reference, timeZone);

  const build = (
    date: { year: number; month: number; day: number },
    clock: { hour: number; minute: number },
  ): Date => zonedTimeToUtc(date.year, date.month, date.day, clock.hour, clock.minute, timeZone);

  // ISO: 2026-08-28 [14:30]
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[\st](\d{1,2}(?:[:h]\d{2})?h?))?$/.exec(raw);
  if (iso) {
    const clock = parseClock(iso[4]) ?? { hour: 9, minute: 0 };
    const year = Number.parseInt(iso[1] ?? '', 10);
    const month = Number.parseInt(iso[2] ?? '', 10);
    const day = Number.parseInt(iso[3] ?? '', 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return build({ year, month, day }, clock);
  }

  // BR: 28/08 [14:30] ou 28/08/2026 [14:30]
  const br = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(\d{1,2}(?:[:h]\d{2})?h?))?$/.exec(raw);
  if (br) {
    const day = Number.parseInt(br[1] ?? '', 10);
    const month = Number.parseInt(br[2] ?? '', 10);
    let year = br[3] ? Number.parseInt(br[3], 10) : today.year;
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const clock = parseClock(br[4]) ?? { hour: 9, minute: 0 };
    return build({ year, month, day }, clock);
  }

  // Palavras-chave de dia + hora opcional
  const keyword = /^(hoje|amanha|depois de amanha)(?:\s+(?:as\s+)?(\d{1,2}(?:[:h]\d{2})?h?))?$/.exec(
    raw,
  );
  if (keyword) {
    const offset = keyword[1] === 'hoje' ? 0 : keyword[1] === 'amanha' ? 1 : 2;
    const clock = parseClock(keyword[2]) ?? { hour: 9, minute: 0 };
    return build(addDaysZoned(today, offset), clock);
  }

  // Dia da semana: "segunda 09:00" -> proxima ocorrencia (nunca hoje)
  const weekday = /^(?:proxima\s+|proximo\s+)?([a-z-]+)(?:\s+(?:as\s+)?(\d{1,2}(?:[:h]\d{2})?h?))?$/.exec(
    raw,
  );
  if (weekday && WEEKDAYS[weekday[1] ?? ''] !== undefined) {
    const targetDow = WEEKDAYS[weekday[1] ?? ''] as number;
    const clock = parseClock(weekday[2]) ?? { hour: 9, minute: 0 };
    const currentDow = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
    let delta = (targetDow - currentDow + 7) % 7;
    if (delta === 0) delta = 7;
    return build(addDaysZoned(today, delta), clock);
  }

  // Somente hora: "18:00" -> hoje; se ja passou, amanha
  const clockOnly = parseClock(raw);
  if (clockOnly) {
    const candidate = build(today, clockOnly);
    if (candidate.getTime() > reference.getTime()) return candidate;
    return build(addDaysZoned(today, 1), clockOnly);
  }

  return null;
}

/**
 * Interpreta um prazo (data sem hora obrigatoria). Sem hora, assume 23:59 local
 * — um prazo "para dia 28" vence no fim do dia 28.
 */
export function parseUserDueDate(
  input: string,
  timeZone: string,
  reference = new Date(),
): Date | null {
  const raw = normalize(input);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(raw);
  const parsed = parseUserDateTime(input, timeZone, reference);
  if (!parsed || !dateOnly) return parsed;

  const parts = getZonedParts(parsed, timeZone);
  return zonedTimeToUtc(parts.year, parts.month, parts.day, 23, 59, timeZone);
}
