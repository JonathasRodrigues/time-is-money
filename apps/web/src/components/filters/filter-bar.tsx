'use client';

import { cn } from '@/lib/utils';

/** Barra de filtros flat — pending só opacidade (a barra de progresso fica no header). */
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
      className={cn(
        'flex flex-wrap items-end gap-x-2 gap-y-2 transition-opacity duration-200',
        pending && 'opacity-60',
        className,
      )}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <span className="sr-only" aria-live="polite">
          Atualizando…
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** Campo com rótulo acima do controle. */
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
