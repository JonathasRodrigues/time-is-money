'use client';

import { useNavigating } from '@/components/navigating';
import { cn } from '@/lib/utils';

/** Conteúdo da página — opacidade suave enquanto navega/filtra. */
export function NavigatingContent({ children }: { children: React.ReactNode }): React.ReactElement {
  const { isPending } = useNavigating();

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col transition-[opacity,filter] duration-200 ease-out',
        isPending && 'pointer-events-none opacity-[0.55]',
      )}
      aria-busy={isPending || undefined}
    >
      {children}
    </div>
  );
}
