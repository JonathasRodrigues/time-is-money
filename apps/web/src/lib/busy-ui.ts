import { cn } from '@/lib/utils';

/** Feedback leve só no item ativo — não apaga o resto da tabela. */
export function busySurfaceClassName({
  busy,
  active,
  className,
}: {
  busy: boolean;
  active: boolean;
  className?: string;
}): string {
  return cn(
    'transition-opacity duration-150',
    active && 'opacity-70',
    busy && !active && 'pointer-events-none',
    className,
  );
}
