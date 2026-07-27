'use client';

import { useFormStatus } from 'react-dom';
import { withActionToast } from '@/lib/action-toast';
import { cn } from '@/lib/utils';

type ServerFormAction = (formData: FormData) => Promise<unknown>;

/**
 * Form padrão TIM: toast + botão com spinner.
 * Sem fade pesado no formulário inteiro (parecia “travado”).
 */
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
    <form action={bound}>
      <FormBusyBody className={className}>{children}</FormBusyBody>
    </form>
  );
}

function FormBusyBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  const { pending } = useFormStatus();

  return (
    <div className={cn(className)} aria-busy={pending || undefined}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </div>
  );
}
