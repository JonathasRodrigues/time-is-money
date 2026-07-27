'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SubmitButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    pendingLabel?: string;
    /** Quando a action é client wrapper / useTransition, passe isto — useFormStatus sozinho não basta. */
    isPending?: boolean;
  };

export function SubmitButton({
  children,
  pendingLabel = 'Salvando…',
  isPending,
  className,
  disabled,
  variant,
  size,
  ...props
}: SubmitButtonProps): React.ReactElement {
  const { pending: formPending } = useFormStatus();
  const pending = Boolean(isPending) || formPending;

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={disabled || pending}
      className={cn(className)}
      aria-busy={pending}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
