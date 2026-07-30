'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  beginMutationToast,
  runMutationWithFeedback,
  type MutationToastOptions,
} from '@/lib/api/mutation-feedback';

/**
 * Hook for server actions / async mutations with toast + cache invalidation.
 * Uses QueryClient from React tree — no global singleton.
 */
export function useMutationFeedback(): {
  beginToast: typeof beginMutationToast;
  run: <T>(work: () => Promise<T>, options: MutationToastOptions) => Promise<T>;
} {
  const queryClient = useQueryClient();

  const run = useCallback(
    <T>(work: () => Promise<T>, options: MutationToastOptions) =>
      runMutationWithFeedback(queryClient, work, options),
    [queryClient],
  );

  return { beginToast: beginMutationToast, run };
}
