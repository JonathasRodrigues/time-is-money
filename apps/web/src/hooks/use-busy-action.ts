'use client';

import { useCallback, useState } from 'react';

/**
 * Estado de busy para mutations (pagar, receber, salvar, confirmar…).
 * Padrão TIM: desativa a superfície envolvida + spinner no botão, sem barra global.
 */
export function useBusyAction<TKey extends string = string>(): {
  busy: boolean;
  busyKey: TKey | null;
  isBusy: (key: TKey) => boolean;
  run: (key: TKey, work: () => Promise<void>) => Promise<void>;
} {
  const [busyKey, setBusyKey] = useState<TKey | null>(null);

  const run = useCallback(async (key: TKey, work: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await work();
    } finally {
      setBusyKey(null);
    }
  }, []);

  const isBusy = useCallback((key: TKey) => busyKey === key, [busyKey]);

  return {
    busy: busyKey != null,
    busyKey,
    isBusy,
    run,
  };
}
