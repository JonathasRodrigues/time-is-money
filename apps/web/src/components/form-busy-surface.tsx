'use client';

import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Envolve o conteúdo de um <form action={…}> e aplica o padrão visual de pending.
 * Deve ser filho (direto ou não) do form.
 */
export function FormBusySurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  const { pending } = useFormStatus();

  return (
    <div
      className={cn(
        'transition-opacity duration-150',
        pending && 'pointer-events-none opacity-55',
        className,
      )}
      aria-busy={pending || undefined}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </div>
  );
}
