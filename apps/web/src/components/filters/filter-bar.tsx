'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Filtros com loading explícito; tabela anterior permanece atrás. */
export function FilterBar({
  children,
  className,
  pending = false,
}: {
  children: React.ReactNode;
  className?: string;
  pending?: boolean;
}): React.ReactElement {
  return (
    <div
      className={cn('flex flex-wrap items-end gap-x-2 gap-y-2', className)}
      aria-busy={pending || undefined}
    >
      {children}
      {pending ? (
        <div className="flex h-9 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-2.5 text-xs font-medium text-primary">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Atualizando…
        </div>
      ) : null}
    </div>
  );
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn('grid min-w-0 gap-1', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
