'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api/endpoints';
import { invalidateMoneyQueries } from '@/lib/api/invalidate';
import { resolveDateRangeWithLegacyMonth, yearMonthsBetween } from '@tim/domain';

/**
 * Materializes fixed series for each month in the payments date range.
 * Runs once per unique filter set — side effects belong here, not in GET loaders.
 */
export function useEnsurePaymentInstances(params: Record<string, string | undefined>): {
  isEnsuring: boolean;
} {
  const queryClient = useQueryClient();
  const lastKeyRef = useRef<string | null>(null);
  const range = resolveDateRangeWithLegacyMonth(params);

  const mutation = useMutation({
    mutationFn: async () => {
      const months = yearMonthsBetween(range.start, range.end);
      await Promise.all(months.map((yearMonth) => api.payments.ensureInstances({ yearMonth })));
    },
    onSuccess: () => invalidateMoneyQueries(queryClient),
  });

  const paramsKey = JSON.stringify({ ...params, start: range.start, end: range.end });

  useEffect(() => {
    if (lastKeyRef.current === paramsKey) return;
    lastKeyRef.current = paramsKey;
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate once per paramsKey
  }, [paramsKey]);

  return { isEnsuring: mutation.isPending };
}
