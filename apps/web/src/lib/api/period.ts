import type { DateRange, PeriodKey } from '@/lib/scope-query';

const PERIOD_KEYS: readonly PeriodKey[] = [
  'this_month',
  'last_month',
  'last_3m',
  'last_6m',
  'last_year',
  'next_month',
  'next_3m',
  'next_6m',
  'next_year',
  'ytd',
  'custom',
];

export function toPeriodKey(period: string): PeriodKey {
  if (PERIOD_KEYS.includes(period as PeriodKey)) {
    return period as PeriodKey;
  }
  return 'this_month';
}

export function toDateRange(range: {
  start: string;
  end: string;
  period: string;
  label: string;
}): DateRange {
  return {
    start: range.start,
    end: range.end,
    label: range.label,
    period: toPeriodKey(range.period),
  };
}
