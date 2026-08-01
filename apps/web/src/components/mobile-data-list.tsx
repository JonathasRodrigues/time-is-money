import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MobileDataListProps = {
  children: ReactNode;
  empty?: ReactNode;
  className?: string;
};

/**
 * Lista mobile plana (divide-y) — evita card dentro de card.
 * Use com tabela `hidden md:block` no desktop.
 */
export function MobileDataList({
  children,
  empty,
  className,
}: MobileDataListProps): React.ReactElement {
  return <div className={cn('divide-y md:hidden', className)}>{empty ?? children}</div>;
}

type AmountTone = 'default' | 'income' | 'expense' | 'muted' | 'danger';

const amountToneClass: Record<AmountTone, string> = {
  default: 'text-foreground',
  income: 'text-primary',
  expense: 'text-foreground',
  muted: 'text-muted-foreground',
  danger: 'text-destructive',
};

type MobileDataCardProps = {
  title: ReactNode;
  /** Linha secundária (categoria, centro, etc.). */
  subtitle?: ReactNode;
  /** Meta em texto pequeno (data, conta…). */
  meta?: ReactNode;
  amount?: ReactNode;
  amountTone?: AmountTone;
  badges?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  selected?: boolean;
  className?: string;
};

/** Linha de lista (sem borda/sombra próprias — o container pai já é o card). */
export function MobileDataCard({
  title,
  subtitle,
  meta,
  amount,
  amountTone = 'default',
  badges,
  leading,
  actions,
  footer,
  selected = false,
  className,
}: MobileDataCardProps): React.ReactElement {
  return (
    <article
      data-selected={selected ? 'true' : undefined}
      className={cn('px-4 py-3.5 transition-colors sm:px-5', selected && 'bg-primary/5', className)}
    >
      <div className="flex items-start gap-3">
        {leading ? <div className="pt-0.5">{leading}</div> : null}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-[15px] font-medium leading-snug tracking-tight">
                {title}
              </p>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {amount != null ? (
              <p
                className={cn(
                  'shrink-0 text-right text-[15px] font-semibold tabular-nums leading-snug',
                  amountToneClass[amountTone],
                )}
              >
                {amount}
              </p>
            ) : null}
          </div>

          {meta || badges ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {badges}
              {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
            </div>
          ) : null}

          {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}

          {actions ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">{actions}</div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function MobileDataEmpty({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">{children}</div>
  );
}
