'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SubmitButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    pendingLabel?: string;
  };

export function SubmitButton({
  children,
  pendingLabel = 'Salvando…',
  className,
  disabled,
  variant,
  size,
  ...props
}: SubmitButtonProps): React.ReactElement {
  const { pending } = useFormStatus();

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
