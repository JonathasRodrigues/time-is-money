import {
  buildScopeHref,
  resolvePeriodKey,
  type PeriodKey,
  type ScopeQuery,
} from '@/lib/scope-query';

export type PersistedScope = {
  period: PeriodKey;
  from?: string;
  to?: string;
  center?: string | null;
};

export const DEFAULT_SCOPE: PersistedScope = {
  period: 'this_month',
  center: null,
};

const STORAGE_KEY = 'tim.scope.v1';

const PERIOD_PATHS = new Set(['/dashboard', '/payments', '/transactions']);
const CENTER_PATHS = new Set(['/dashboard', '/payments', '/transactions', '/financings']);

export function pathUsesPeriod(pathname: string): boolean {
  return PERIOD_PATHS.has(pathname);
}

export function pathUsesCenter(pathname: string): boolean {
  return CENTER_PATHS.has(pathname);
}

export function readPersistedScope(): PersistedScope {
  if (typeof window === 'undefined') return DEFAULT_SCOPE;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCOPE;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SCOPE;
    const record = parsed as Record<string, unknown>;
    const period = resolvePeriodKey(typeof record.period === 'string' ? record.period : undefined);
    const from = typeof record.from === 'string' ? record.from : undefined;
    const to = typeof record.to === 'string' ? record.to : undefined;
    const center = typeof record.center === 'string' ? record.center : null;
    return {
      period,
      from: period === 'custom' ? from : undefined,
      to: period === 'custom' ? to : undefined,
      center,
    };
  } catch {
    return DEFAULT_SCOPE;
  }
}

export function writePersistedScope(scope: PersistedScope): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
  } catch {
    // sessionStorage pode estar indisponível (modo privado / quota).
  }
}

export function mergePersistedScope(
  current: PersistedScope,
  patch: Partial<PersistedScope>,
): PersistedScope {
  const period = patch.period ?? current.period;
  const next: PersistedScope = {
    period,
    center: patch.center !== undefined ? patch.center : current.center,
    from: undefined,
    to: undefined,
  };
  if (period === 'custom') {
    next.from = patch.from !== undefined ? patch.from : current.from;
    next.to = patch.to !== undefined ? patch.to : current.to;
  }
  return next;
}

/** Monta href de navegação carregando período/centro persistidos nas telas que usam. */
export function scopedNavHref(pathname: string, scope: PersistedScope): string {
  const query: ScopeQuery = {};
  if (pathUsesCenter(pathname) && scope.center) {
    query.center = scope.center;
  }
  if (pathUsesPeriod(pathname)) {
    query.period = scope.period;
    if (scope.period === 'custom') {
      query.from = scope.from;
      query.to = scope.to;
    }
  }
  return buildScopeHref(pathname, query);
}
