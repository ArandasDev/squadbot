import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  isValidTimeZone,
  parseUserDateTime,
  parseUserDueDate,
  zonedTimeToUtc,
} from '../src/utils/dates.js';

const SP = 'America/Sao_Paulo';
// 26/08/2026, 09:00 em Sao Paulo (UTC-3).
const REFERENCE = new Date('2026-08-26T12:00:00.000Z');

describe('utils/dates', () => {
  it('converte hora local para UTC respeitando o fuso', () => {
    expect(zonedTimeToUtc(2026, 8, 28, 9, 0, SP).toISOString()).toBe('2026-08-28T12:00:00.000Z');
    expect(zonedTimeToUtc(2026, 8, 28, 9, 0, 'UTC').toISOString()).toBe('2026-08-28T09:00:00.000Z');
    expect(zonedTimeToUtc(2026, 1, 15, 12, 0, 'Asia/Tokyo').toISOString()).toBe(
      '2026-01-15T03:00:00.000Z',
    );
  });

  it('formata no fuso do usuario', () => {
    const instant = new Date('2026-08-28T12:00:00.000Z');
    expect(formatDateTime(instant, SP)).toBe('28/08/2026, 09:00');
    expect(formatDateTime(instant, 'UTC')).toBe('28/08/2026, 12:00');
  });

  it('interpreta "amanha" e "hoje" com hora', () => {
    expect(parseUserDateTime('amanha 09:00', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-27T12:00:00.000Z',
    );
    expect(parseUserDateTime('hoje 18:00', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-26T21:00:00.000Z',
    );
    expect(parseUserDateTime('amanhã 09:00', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-27T12:00:00.000Z',
    );
  });

  it('interpreta datas ISO e no formato brasileiro', () => {
    expect(parseUserDateTime('2026-08-28 14:30', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-28T17:30:00.000Z',
    );
    expect(parseUserDateTime('28/08 14:30', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-28T17:30:00.000Z',
    );
    expect(parseUserDateTime('28/08/2027', SP, REFERENCE)?.toISOString()).toBe(
      '2027-08-28T12:00:00.000Z',
    );
  });

  it('interpreta duracoes relativas', () => {
    expect(parseUserDateTime('30m', SP, REFERENCE)?.toISOString()).toBe('2026-08-26T12:30:00.000Z');
    expect(parseUserDateTime('2h', SP, REFERENCE)?.toISOString()).toBe('2026-08-26T14:00:00.000Z');
    expect(parseUserDateTime('em 3 dias', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-29T12:00:00.000Z',
    );
  });

  it('joga "so hora" para amanha quando o horario ja passou hoje', () => {
    // Sao 09:00 em Sao Paulo; 08:00 ja passou.
    expect(parseUserDateTime('08:00', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-27T11:00:00.000Z',
    );
    expect(parseUserDateTime('18:00', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-26T21:00:00.000Z',
    );
  });

  it('resolve dias da semana para a proxima ocorrencia', () => {
    // 26/08/2026 é uma quarta-feira.
    const sexta = parseUserDateTime('sexta 14:00', SP, REFERENCE);
    expect(sexta?.toISOString()).toBe('2026-08-28T17:00:00.000Z');

    // "quarta" no dia da propria quarta aponta para a semana seguinte.
    const quarta = parseUserDateTime('quarta 14:00', SP, REFERENCE);
    expect(quarta?.toISOString()).toBe('2026-09-02T17:00:00.000Z');
  });

  it('devolve null para entradas que nao entende', () => {
    expect(parseUserDateTime('quando der', SP, REFERENCE)).toBeNull();
    expect(parseUserDateTime('', SP, REFERENCE)).toBeNull();
    expect(parseUserDateTime('99/99', SP, REFERENCE)).toBeNull();
  });

  it('trata prazo sem hora como fim do dia local', () => {
    expect(parseUserDueDate('2026-08-28', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-29T02:59:00.000Z',
    );
    // Com hora explicita, respeita a hora informada.
    expect(parseUserDueDate('2026-08-28 10:00', SP, REFERENCE)?.toISOString()).toBe(
      '2026-08-28T13:00:00.000Z',
    );
  });

  it('valida identificadores de timezone', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Marte/Olympus')).toBe(false);
  });
});
