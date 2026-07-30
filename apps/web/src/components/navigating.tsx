'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from 'react';

type NavigatingContextValue = {
  /** Só filtro / searchParams. */
  isFilterPending: boolean;
  runTransition: (action: () => void) => void;
};

const NavigatingContext = createContext<NavigatingContextValue | null>(null);

export function NavigatingProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [filterPending, startTransition] = useTransition();

  const runTransition = useCallback(
    (action: () => void) => {
      startTransition(action);
    },
    [startTransition],
  );

  const value = useMemo(
    () => ({
      isFilterPending: filterPending,
      runTransition,
    }),
    [filterPending, runTransition],
  );

  return <NavigatingContext.Provider value={value}>{children}</NavigatingContext.Provider>;
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
