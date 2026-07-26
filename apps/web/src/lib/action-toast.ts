'use client';

import { toast } from 'sonner';

function isNextNavigationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const digest = String((error as { digest: unknown }).digest);
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND');
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Envolve server action de FormData com toast loading/sucesso/erro.
 * Relança redirects do Next para não engolir a navegação.
 */
export function withActionToast(
  action: (formData: FormData) => Promise<unknown>,
  options: {
    loading?: string;
    success: string;
    error?: string;
  },
): (formData: FormData) => Promise<void> {
  return async (formData: FormData) => {
    const toastId = toast.loading(options.loading ?? 'Salvando…');
    try {
      await action(formData);
      toast.success(options.success, { id: toastId });
    } catch (error: unknown) {
      if (isNextNavigationError(error)) {
        toast.success(options.success, { id: toastId });
        throw error;
      }
      toast.error(errorMessage(error, options.error ?? 'Não foi possível salvar'), {
        id: toastId,
      });
    }
  };
}

/** Para mutations chamadas via startTransition (sem FormData). */
export async function runWithToast<T>(
  work: () => Promise<T>,
  options: {
    loading?: string;
    success: string;
    error?: string;
  },
): Promise<T> {
  const toastId = toast.loading(options.loading ?? 'Salvando…');
  try {
    const result = await work();
    toast.success(options.success, { id: toastId });
    return result;
  } catch (error: unknown) {
    if (isNextNavigationError(error)) {
      toast.success(options.success, { id: toastId });
      throw error;
    }
    toast.error(errorMessage(error, options.error ?? 'Não foi possível salvar'), { id: toastId });
    throw error;
  }
}
