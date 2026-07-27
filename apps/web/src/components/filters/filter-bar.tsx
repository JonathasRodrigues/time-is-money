'use client';

import { cn } from '@/lib/utils';

/** Barra de filtros flat — com indicador de atualização. */
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
      className={cn('relative flex flex-wrap items-end gap-x-2 gap-y-2', className)}
      aria-busy={pending || undefined}
    >
      <div
        className={cn(
          'flex flex-wrap items-end gap-x-2 gap-y-2 transition-opacity duration-200',
          pending && 'opacity-70',
        )}
      >
        {children}
      </div>
      {pending ? (
        <>
          <span className="sr-only" aria-live="polite">
            Atualizando…
          </span>
          <div className="pointer-events-none absolute inset-x-0 -bottom-1 h-0.5 overflow-hidden rounded-full">
            <div className="h-full w-1/3 animate-navigation-progress bg-primary/70" />
          </div>
        </>
      ) : null}
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
