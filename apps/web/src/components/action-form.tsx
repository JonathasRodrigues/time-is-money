'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, type FormEvent } from 'react';
import { ActionFormPendingProvider } from '@/components/action-form-context';
import { runMutationWithFeedback, type MutationToastOptions } from '@/lib/api/mutation-feedback';
import { cn } from '@/lib/utils';

type FormMutation = (formData: FormData) => Promise<unknown>;

export type ActionFormProps = {
  action: FormMutation;
  successMessage: string;
  loadingMessage?: string;
  invalidate?: MutationToastOptions['invalidate'] | false;
  className?: string;
  children: React.ReactNode;
  onSuccess?: () => void;
};

/**
 * Client form wrapper: toast, cache invalidation, disabled state (REST via @/lib/api/mutations).
 */
export function ActionForm({
  action,
  successMessage,
  loadingMessage = 'Salvando…',
  invalidate = 'money',
  className,
  children,
  onSuccess,
}: ActionFormProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      setPending(true);
      void runMutationWithFeedback(queryClient, () => action(formData), {
        loading: loadingMessage,
        success: successMessage,
        ...(invalidate ? { invalidate } : {}),
      })
        .then(() => {
          onSuccess?.();
        })
        .catch(() => {
          // toast handled in runMutationWithFeedback
        })
        .finally(() => {
          setPending(false);
        });
    },
    [action, invalidate, loadingMessage, onSuccess, queryClient, successMessage],
  );

  return (
    <form onSubmit={onSubmit} className={cn(className)} aria-busy={pending || undefined}>
      <ActionFormPendingProvider pending={pending}>
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
      </ActionFormPendingProvider>
    </form>
  );
}
