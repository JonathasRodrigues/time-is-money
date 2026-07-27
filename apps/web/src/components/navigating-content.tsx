'use client';

import { Loader2 } from 'lucide-react';
import { useNavigating } from '@/components/navigating';
import { cn } from '@/lib/utils';

/**
 * Loading visível sem “matar” a UI:
 * - filtro: faixa “Atualizando…” + conteúdo anterior permanece
 * - troca de tela: faixa + leve bloqueio de clique
 */
export function NavigatingContent({ children }: { children: React.ReactNode }): React.ReactElement {
  const { isLinkPending, isFilterPending } = useNavigating();
  const loading = isLinkPending || isFilterPending;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" aria-busy={loading || undefined}>
      {loading ? (
        <div
          className="mb-3 flex shrink-0 items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground"
          role="status"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
          <span className="font-medium">
            {isLinkPending ? 'Carregando página…' : 'Atualizando resultados…'}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col transition-opacity duration-150',
          isLinkPending && 'pointer-events-none opacity-70',
          isFilterPending && !isLinkPending && 'pointer-events-none',
        )}
      >
        {children}
      </div>
    </div>
  );
}
