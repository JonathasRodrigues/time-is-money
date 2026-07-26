const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type PeriodKey = 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'ytd' | 'custom';

export interface ScopeQuery {
  center?: string | null;
  period?: PeriodKey;
  from?: string;
  to?: string;
  type?: 'income' | 'expense' | null;
  status?: 'pending' | 'paid' | null;
  category?: string | null;
  q?: string | null;
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

export function monthBounds(date = new Date()): { start: string; end: string; label: string } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const start = `${y}-${pad(m + 1)}-01`;
  const endDate = new Date(Date.UTC(y, m + 1, 0));
  const end = toIso(endDate);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(date);
  return { start, end, label };
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
      label: bounds.label.replace('.', ''),
    };
  }

  if (period === 'last_3m') {
    const end = monthBounds(now).end;
    const start = monthBounds(shiftMonth(now, -2)).start;
    return { start, end, period, label: 'Últimos 3 meses' };
  }

  if (period === 'last_6m') {
    const end = monthBounds(now).end;
    const start = monthBounds(shiftMonth(now, -5)).start;
    return { start, end, period, label: 'Últimos 6 meses' };
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
    label: bounds.label.replace('.', ''),
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

export function buildScopeHref(basePath: string, query: ScopeQuery): string {
  const params = new URLSearchParams();
  if (query.center) params.set('center', query.center);
  if (query.period && query.period !== 'this_month') params.set('period', query.period);
  if (query.period === 'custom') {
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
  }
  if (query.type === 'income' || query.type === 'expense') params.set('type', query.type);
  if (query.status === 'pending' || query.status === 'paid') params.set('status', query.status);
  if (query.category) params.set('category', query.category);
  if (query.q && query.q.trim()) params.set('q', query.q.trim());
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
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
