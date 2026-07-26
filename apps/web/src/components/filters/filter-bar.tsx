'use client';

import { cn } from '@/lib/utils';

/** Barra de filtros flat — sem card; só alinha os controles. */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn('flex flex-wrap items-end gap-x-2 gap-y-2', className)}>{children}</div>
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
