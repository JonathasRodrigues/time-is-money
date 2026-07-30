'use client';

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  DEFAULT_SCOPE,
  mergePersistedScope,
  pathUsesCenter,
  pathUsesPeriod,
  readPersistedScope,
  scopedNavHref,
  writePersistedScope,
  type PersistedScope,
} from '@/lib/scope-preference';
import { resolvePeriodKey } from '@/lib/scope-query';

type ScopePreferenceContextValue = {
  scope: PersistedScope;
  rememberScope: (patch: Partial<PersistedScope>) => void;
  navHref: (pathname: string) => string;
};

const ScopePreferenceContext = createContext<ScopePreferenceContextValue | null>(null);

function ScopeUrlSync(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { rememberScope } = useScopePreference();

  useEffect(() => {
    if (!pathUsesPeriod(pathname) && !pathUsesCenter(pathname)) return;

    const period = searchParams.get('period');
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const center = searchParams.get('center');

    const patch: Partial<PersistedScope> = {};
    if (pathUsesPeriod(pathname) && (period || (from && to))) {
      patch.period = resolvePeriodKey(period ?? 'custom');
      patch.from = from;
      patch.to = to;
    }
    if (pathUsesCenter(pathname) && center) {
      patch.center = center;
    }
    if (Object.keys(patch).length > 0) {
      rememberScope(patch);
    }
  }, [pathname, searchParams, rememberScope]);

  return null;
}

export function ScopePreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [scope, setScope] = useState<PersistedScope>(DEFAULT_SCOPE);

  useEffect(() => {
    setScope(readPersistedScope());
  }, []);

  const rememberScope = useCallback((patch: Partial<PersistedScope>) => {
    setScope((current) => {
      const next = mergePersistedScope(current, patch);
      writePersistedScope(next);
      return next;
    });
  }, []);

  const navHref = useCallback((pathname: string) => scopedNavHref(pathname, scope), [scope]);

  const value = useMemo(() => ({ scope, rememberScope, navHref }), [scope, rememberScope, navHref]);

  return (
    <ScopePreferenceContext.Provider value={value}>
      <Suspense fallback={null}>
        <ScopeUrlSync />
      </Suspense>
      {children}
    </ScopePreferenceContext.Provider>
  );
}

export function useScopePreference(): ScopePreferenceContextValue {
  const ctx = useContext(ScopePreferenceContext);
  if (!ctx) {
    throw new Error('useScopePreference must be used within ScopePreferenceProvider');
  }
  return ctx;
}
