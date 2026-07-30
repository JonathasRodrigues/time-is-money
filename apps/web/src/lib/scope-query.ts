import { resolvePeriodKey, type DateRange, type PeriodKey, type ScopeQuery } from '@tim/domain';

export type { DateRange, PeriodKey, ScopeQuery };

export {
  daysBetweenInclusive,
  formatScopeDateBr,
  monthBounds,
  previousRangeOfSameLength,
  resolveCostCenterId,
  resolveDateRange,
  resolveDateRangeWithLegacyMonth,
  resolvePeriodKey,
  shiftMonth,
  yearMonthsBetween,
} from '@tim/domain';

/** UI helper — builds hrefs for scope filters in client components. */
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
  if (query.bank) params.set('bank', query.bank);
  if (query.account) params.set('account', query.account);
  if (query.rail) params.set('rail', query.rail);
  if (query.card) params.set('card', query.card);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function toPeriodKey(value: string | undefined): PeriodKey {
  return resolvePeriodKey(value);
}
