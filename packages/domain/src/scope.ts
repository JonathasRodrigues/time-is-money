const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type PeriodKey =
  | 'this_month'
  | 'last_month'
  | 'last_3m'
  | 'last_6m'
  | 'last_year'
  | 'next_month'
  | 'next_3m'
  | 'next_6m'
  | 'next_year'
  | 'ytd'
  | 'custom';

export interface ScopeQuery {
  center?: string | null;
  period?: PeriodKey;
  from?: string;
  to?: string;
  type?: 'income' | 'expense' | null;
  status?: 'pending' | 'paid' | null;
  category?: string | null;
  q?: string | null;
  /** Institution (banco). */
  bank?: string | null;
  /** Account id. */
  account?: string | null;
  /** payment_rail ou `credit_card` (compra no cartão). */
  rail?: string | null;
  /** Credit card id. */
  card?: string | null;
}

export interface DateRange {
  start: string;
  end: string;
  period: PeriodKey;
  label: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Rótulo de mês em pt-BR (`Julho de 2026` ou `Jul 26`). */
export function formatMonthLabel(date: Date, style: 'short' | 'long' = 'long'): string {
  const raw = new Intl.DateTimeFormat('pt-BR', {
    month: style,
    year: style === 'short' ? '2-digit' : 'numeric',
    timeZone: 'UTC',
  }).format(date);
  const cleaned = raw.replace(/\.$/, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function monthBounds(
  date = new Date(),
  labelStyle: 'short' | 'long' = 'long',
): { start: string; end: string; label: string } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const start = `${y}-${pad(m + 1)}-01`;
  const endDate = new Date(Date.UTC(y, m + 1, 0));
  const end = toIso(endDate);
  return { start, end, label: formatMonthLabel(date, labelStyle) };
}

export function shiftMonth(base: Date, delta: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + delta, 1));
}

function parseIsoDate(value: string | undefined): string | null {
  if (!value || !ISO_DATE.test(value)) return null;
  return value;
}

export function resolvePeriodKey(raw: string | string[] | undefined): PeriodKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    value === 'last_month' ||
    value === 'last_3m' ||
    value === 'last_6m' ||
    value === 'last_year' ||
    value === 'next_month' ||
    value === 'next_3m' ||
    value === 'next_6m' ||
    value === 'next_year' ||
    value === 'ytd' ||
    value === 'custom'
  ) {
    return value;
  }
  return 'this_month';
}

export function resolveCostCenterId(
  raw: string | string[] | undefined,
  validIds: ReadonlySet<string>,
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value === 'all') return null;
  return validIds.has(value) ? value : null;
}

export function formatScopeDateBr(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function resolveDateRange(
  params: {
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
  },
  now = new Date(),
): DateRange {
  const period = resolvePeriodKey(params.period);
  const fromParam = Array.isArray(params.from) ? params.from[0] : params.from;
  const toParam = Array.isArray(params.to) ? params.to[0] : params.to;

  if (period === 'custom') {
    const from = parseIsoDate(fromParam);
    const to = parseIsoDate(toParam);
    if (from && to) {
      const start = from <= to ? from : to;
      const end = from <= to ? to : from;
      return {
        start,
        end,
        period: 'custom',
        label: `${formatScopeDateBr(start)} – ${formatScopeDateBr(end)}`,
      };
    }
  }

  if (period === 'last_month') {
    const bounds = monthBounds(shiftMonth(now, -1));
    return {
      start: bounds.start,
      end: bounds.end,
      period,
      label: bounds.label,
    };
  }

  if (period === 'next_month') {
    const bounds = monthBounds(shiftMonth(now, 1));
    return {
      start: bounds.start,
      end: bounds.end,
      period,
      label: bounds.label,
    };
  }

  if (period === 'last_3m') {
    const end = monthBounds(now).end;
    const start = monthBounds(shiftMonth(now, -2)).start;
    return { start, end, period, label: 'Últimos 3 meses' };
  }

  if (period === 'next_3m') {
    const start = monthBounds(now).start;
    const end = monthBounds(shiftMonth(now, 2)).end;
    return { start, end, period, label: 'Próximos 3 meses' };
  }

  if (period === 'last_6m') {
    const end = monthBounds(now).end;
    const start = monthBounds(shiftMonth(now, -5)).start;
    return { start, end, period, label: 'Últimos 6 meses' };
  }

  if (period === 'next_6m') {
    const start = monthBounds(now).start;
    const end = monthBounds(shiftMonth(now, 5)).end;
    return { start, end, period, label: 'Próximos 6 meses' };
  }

  if (period === 'last_year') {
    const y = now.getUTCFullYear() - 1;
    return {
      start: `${y}-01-01`,
      end: `${y}-12-31`,
      period,
      label: `Ano ${y}`,
    };
  }

  if (period === 'next_year') {
    const y = now.getUTCFullYear() + 1;
    return {
      start: `${y}-01-01`,
      end: `${y}-12-31`,
      period,
      label: `Ano ${y}`,
    };
  }

  if (period === 'ytd') {
    const y = now.getUTCFullYear();
    return {
      start: `${y}-01-01`,
      end: monthBounds(now).end,
      period,
      label: `Ano ${y}`,
    };
  }

  const bounds = monthBounds(now);
  return {
    start: bounds.start,
    end: bounds.end,
    period: 'this_month',
    label: bounds.label,
  };
}

/** Período imediatamente anterior, com a mesma duração em dias. */
export function previousRangeOfSameLength(range: DateRange): { start: string; end: string } {
  const start = new Date(`${range.start}T00:00:00.000Z`);
  const end = new Date(`${range.end}T00:00:00.000Z`);
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { start: toIso(prevStart), end: toIso(prevEnd) };
}

export function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00.000Z`);
  const b = new Date(`${end}T00:00:00.000Z`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1);
}

/**
 * Janela operacional do radar de caixa alinhada ao período da dashboard.
 *
 * - Período só no passado → inativo (radar não faz sentido com o filtro).
 * - Período que inclui hoje ou futuro → obrigações de `today` (ou início futuro)
 *   até o fim do período, sempre incluindo atrasos.
 */
export function resolveCashRadarWindow(input: {
  today: string;
  rangeStart: string;
  rangeEnd: string;
}): {
  active: boolean;
  horizonStart: string;
  horizonEnd: string;
  horizonDays: number;
  horizonLabel: string;
} {
  const { today, rangeStart, rangeEnd } = input;

  if (rangeEnd < today) {
    return {
      active: false,
      horizonStart: today,
      horizonEnd: today,
      horizonDays: 0,
      horizonLabel: '',
    };
  }

  const horizonStart = rangeStart > today ? rangeStart : today;
  const horizonEnd = rangeEnd;
  const horizonDays = daysBetweenInclusive(horizonStart, horizonEnd);
  const horizonLabel =
    horizonStart === horizonEnd
      ? formatScopeDateBr(horizonStart)
      : `${formatScopeDateBr(horizonStart)} – ${formatScopeDateBr(horizonEnd)}`;

  return {
    active: true,
    horizonStart,
    horizonEnd,
    horizonDays,
    horizonLabel,
  };
}

/** Lista `YYYY-MM` inclusivos entre duas datas ISO. */
export function yearMonthsBetween(startIso: string, endIso: string): string[] {
  const startYm = startIso.slice(0, 7);
  const endYm = endIso.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(startYm) || !/^\d{4}-\d{2}$/.test(endYm)) return [];

  const months: string[] = [];
  let [y, m] = startYm.split('-').map(Number) as [number, number];
  const [endY, endM] = endYm.split('-').map(Number) as [number, number];

  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${pad(m)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

/** Compat: `?month=YYYY-MM` vira intervalo custom daquele mês. */
export function resolveDateRangeWithLegacyMonth(
  params: {
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
    month?: string | string[];
  },
  now = new Date(),
): DateRange {
  const periodRaw = Array.isArray(params.period) ? params.period[0] : params.period;
  const monthRaw = Array.isArray(params.month) ? params.month[0] : params.month;
  if (!periodRaw && monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)) {
    const [y, m] = monthRaw.split('-').map(Number);
    const endDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    const start = `${monthRaw}-01`;
    const end = `${monthRaw}-${pad(endDay)}`;
    return {
      start,
      end,
      period: 'custom',
      label: `${formatScopeDateBr(start)} – ${formatScopeDateBr(end)}`,
    };
  }
  return resolveDateRange(params, now);
}
