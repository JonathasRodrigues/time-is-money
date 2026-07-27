import { cn } from '@/lib/utils';

/**
 * Classes padrão para linha/card durante mutation.
 * - `active`: item sendo processado (opacidade média + fundo)
 * - demais itens, com `busy`: mais apagados e sem clique
 */
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
    active && 'bg-muted/40 opacity-55',
    busy && !active && 'pointer-events-none opacity-40',
    className,
  );
}
