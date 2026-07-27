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

export type ActionToastOptions = {
  loading?: string;
  success: string;
  error?: string;
  /** Se já disparou `toast.loading` no clique (antes do await / transition). */
  toastId?: string | number;
};

/** Dispara toast loading no mesmo frame do clique — antes de startTransition/await. */
export function beginActionToast(loading = 'Salvando…'): string | number {
  return toast.loading(loading);
}

/**
 * Envolve server action de FormData com toast loading/sucesso/erro.
 * Relança redirects do Next para não engolir a navegação.
 */
export function withActionToast(
  action: (formData: FormData) => Promise<unknown>,
  options: ActionToastOptions,
): (formData: FormData) => Promise<void> {
  return async (formData: FormData) => {
    await runWithToast(() => action(formData), options);
  };
}

/**
 * Para mutations via startTransition: passe `toastId` de `beginActionToast`
 * para o loading aparecer no clique, e success assim que a action retorna
 * (não amarrar a sensação de pronto ao flight RSC).
 */
export async function runWithToast<T>(
  work: () => Promise<T>,
  options: ActionToastOptions,
): Promise<T> {
  const toastId = options.toastId ?? toast.loading(options.loading ?? 'Salvando…');
  try {
    const result = await work();
    toast.success(options.success, { id: toastId });
    return result;
  } catch (error: unknown) {
    if (isNextNavigationError(error)) {
      toast.success(options.success, { id: toastId });
      throw error;
    }
    toast.error(errorMessage(error, options.error ?? 'Não foi possível salvar'), {
      id: toastId,
    });
    throw error;
  }
}
