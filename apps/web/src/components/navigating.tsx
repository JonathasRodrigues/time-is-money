'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type NavigatingContextValue = {
  /** Troca de rota via Link (menu). */
  isLinkPending: boolean;
  /** Só filtro / searchParams (mantém UI anterior). */
  isFilterPending: boolean;
  /** Qualquer um dos dois — use com cuidado. */
  isPending: boolean;
  beginLinkNavigation: () => void;
  runTransition: (action: () => void) => void;
};

const NavigatingContext = createContext<NavigatingContextValue | null>(null);

function normalizeRouteKey(pathname: string, search: string): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  return query ? `${pathname}?${query}` : pathname;
}

export function NavigatingProvider({ children }: { children: ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = normalizeRouteKey(pathname, searchParams.toString());
  const [filterPending, startTransition] = useTransition();
  const [linkPending, setLinkPending] = useState(false);

  useEffect(() => {
    setLinkPending(false);
  }, [routeKey]);

  useEffect(() => {
    if (!linkPending) return undefined;
    const timer = window.setTimeout(() => setLinkPending(false), 8_000);
    return () => window.clearTimeout(timer);
  }, [linkPending]);

  const beginLinkNavigation = useCallback(() => {
    setLinkPending(true);
  }, []);

  const runTransition = useCallback(
    (action: () => void) => {
      startTransition(action);
    },
    [startTransition],
  );

  const value = useMemo(
    () => ({
      isLinkPending: linkPending,
      isFilterPending: filterPending,
      isPending: filterPending || linkPending,
      beginLinkNavigation,
      runTransition,
    }),
    [linkPending, filterPending, beginLinkNavigation, runTransition],
  );

  return <NavigatingContext.Provider value={value}>{children}</NavigatingContext.Provider>;
}

export function useNavigating(): NavigatingContextValue {
  const ctx = useContext(NavigatingContext);
  if (!ctx) {
    throw new Error('useNavigating must be used within NavigatingProvider');
  }
  return ctx;
}

/** Filtros — transition sem apagar a tabela. */
export function useSoftNavigate(): {
  isPending: boolean;
  navigate: (action: () => void) => void;
} {
  const ctx = useContext(NavigatingContext);
  const [localPending, startLocal] = useTransition();

  if (!ctx) {
    return {
      isPending: localPending,
      navigate: (action: () => void) => {
        startLocal(action);
      },
    };
  }

  return {
    isPending: ctx.isFilterPending,
    navigate: ctx.runTransition,
  };
}
