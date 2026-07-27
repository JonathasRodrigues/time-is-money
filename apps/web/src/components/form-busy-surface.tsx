'use client';

import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';

/** Filho de <form action> — desabilita campos sem fade agressivo. */
export function FormBusySurface({
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
