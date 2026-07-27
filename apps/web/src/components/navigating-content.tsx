'use client';

import { useNavigating } from '@/components/navigating';
import { cn } from '@/lib/utils';

/** Conteúdo da página — bloqueia clique enquanto navega; sem fade pesado. */
export function NavigatingContent({ children }: { children: React.ReactNode }): React.ReactElement {
  const { isPending } = useNavigating();

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col transition-opacity duration-150',
        isPending && 'pointer-events-none opacity-80',
      )}
      aria-busy={isPending || undefined}
    >
      {children}
    </div>
  );
}
