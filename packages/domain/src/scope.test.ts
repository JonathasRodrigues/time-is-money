import { describe, expect, it } from 'vitest';
import { resolveDateRange, resolvePeriodKey, resolveCashRadarWindow } from './scope';

describe('resolvePeriodKey', () => {
  it('aceita presets de futuro', () => {
    expect(resolvePeriodKey('next_month')).toBe('next_month');
    expect(resolvePeriodKey('next_3m')).toBe('next_3m');
    expect(resolvePeriodKey('next_6m')).toBe('next_6m');
    expect(resolvePeriodKey('next_year')).toBe('next_year');
    expect(resolvePeriodKey('last_year')).toBe('last_year');
  });
});

describe('resolveDateRange', () => {
  const now = new Date('2026-07-28T15:00:00.000Z');

  it('resolve next_month', () => {
    const range = resolveDateRange({ period: 'next_month' }, now);
    expect(range).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
      period: 'next_month',
      label: 'Agosto de 2026',
    });
  });

  it('resolve this_month com nome completo', () => {
    const range = resolveDateRange({ period: 'this_month' }, now);
    expect(range.label).toBe('Julho de 2026');
  });

  it('resolve next_3m (este mês + 2 à frente)', () => {
    const range = resolveDateRange({ period: 'next_3m' }, now);
    expect(range).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
      period: 'next_3m',
      label: 'Próximos 3 meses',
    });
  });

  it('resolve next_6m', () => {
    const range = resolveDateRange({ period: 'next_6m' }, now);
    expect(range).toEqual({
      start: '2026-07-01',
      end: '2026-12-31',
      period: 'next_6m',
      label: 'Próximos 6 meses',
    });
  });

  it('resolve next_year', () => {
    const range = resolveDateRange({ period: 'next_year' }, now);
    expect(range).toEqual({
      start: '2027-01-01',
      end: '2027-12-31',
      period: 'next_year',
      label: 'Ano 2027',
    });
  });

  it('aceita custom no futuro', () => {
    const range = resolveDateRange({ period: 'custom', from: '2026-08-01', to: '2027-01-15' }, now);
    expect(range.start).toBe('2026-08-01');
    expect(range.end).toBe('2027-01-15');
    expect(range.period).toBe('custom');
  });
});

describe('resolveCashRadarWindow', () => {
  it('desativa quando o período já terminou', () => {
    const window = resolveCashRadarWindow({
      today: '2026-07-28',
      rangeStart: '2026-06-01',
      rangeEnd: '2026-06-30',
    });
    expect(window.active).toBe(false);
    expect(window.horizonDays).toBe(0);
  });

  it('neste mês usa de hoje até o fim do período', () => {
    const window = resolveCashRadarWindow({
      today: '2026-07-28',
      rangeStart: '2026-07-01',
      rangeEnd: '2026-07-31',
    });
    expect(window).toMatchObject({
      active: true,
      horizonStart: '2026-07-28',
      horizonEnd: '2026-07-31',
      horizonDays: 4,
    });
  });

  it('no próximo mês usa o intervalo futuro inteiro', () => {
    const window = resolveCashRadarWindow({
      today: '2026-07-28',
      rangeStart: '2026-08-01',
      rangeEnd: '2026-08-31',
    });
    expect(window).toMatchObject({
      active: true,
      horizonStart: '2026-08-01',
      horizonEnd: '2026-08-31',
      horizonDays: 31,
    });
  });
});
