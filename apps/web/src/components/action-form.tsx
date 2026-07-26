'use client';

import { withActionToast } from '@/lib/action-toast';

type ServerFormAction = (formData: FormData) => Promise<unknown>;

export function ActionForm({
  action,
  successMessage,
  loadingMessage = 'Salvando…',
  className,
  children,
}: {
  action: ServerFormAction;
  successMessage: string;
  loadingMessage?: string;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const bound = withActionToast(action, {
    loading: loadingMessage,
    success: successMessage,
  });

  return (
    <form action={bound} className={className}>
      {children}
    </form>
  );
}
