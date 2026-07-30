'use client';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invalidateByScope, type InvalidateScope } from '@/lib/api/invalidate';

function isNextNavigationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const digest = String((error as { digest: unknown }).digest);
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND');
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export type MutationToastOptions = {
  loading?: string;
  success: string;
  error?: string;
  toastId?: string | number;
  invalidate?: InvalidateScope | readonly InvalidateScope[];
};

export function beginMutationToast(loading = 'Salvando…'): string | number {
  return toast.loading(loading);
}

/**
 * Runs async work with toast feedback and optional React Query cache invalidation.
 * Requires QueryClient from the component tree (no global ref).
 */
export async function runMutationWithFeedback<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  work: () => Promise<T>,
  options: MutationToastOptions,
): Promise<T> {
  const toastId = options.toastId ?? toast.loading(options.loading ?? 'Salvando…');
  try {
    const result = await work();
    toast.success(options.success, { id: toastId });
    if (options.invalidate) {
      await invalidateByScope(queryClient, options.invalidate);
    }
    return result;
  } catch (error: unknown) {
    if (isNextNavigationError(error)) {
      toast.success(options.success, { id: toastId });
      throw error;
    }
    toast.error(errorMessage(error, options.error ?? 'Não foi possível concluir'), {
      id: toastId,
    });
    throw error;
  }
}
