import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  size = 'md',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative' | 'accent';
  size?: 'md' | 'lg';
}): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-card shadow-sm',
        size === 'lg' ? 'px-5 py-4' : 'px-4 py-3.5',
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1.5 font-semibold tabular-nums tracking-tight text-foreground',
          size === 'lg' ? 'text-[1.65rem] leading-none' : 'text-xl leading-none',
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            'mt-2 text-xs tabular-nums',
            tone === 'positive' && 'text-primary',
            tone === 'negative' && 'text-destructive',
            (tone === 'default' || tone === 'accent') && 'text-muted-foreground',
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function InsightItem({
  title,
  detail,
  tone = 'neutral',
}: {
  title: string;
  detail: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}): React.ReactElement {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={cn(
          'mt-1.5 size-1.5 shrink-0 rounded-full',
          tone === 'warn' && 'bg-[var(--tim-warning)]',
          tone === 'bad' && 'bg-destructive',
          tone === 'neutral' && 'bg-muted-foreground/35',
          tone === 'good' && 'bg-primary',
        )}
      />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function SectionLink({ href, label }: { href: string; label: string }): React.ReactElement {
  return (
    <Link
      href={href}
      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
    >
      {label}
    </Link>
  );
}

export function StatusBadge({
  label,
  variant = 'outline',
}: {
  label: string;
  variant?: 'outline' | 'secondary' | 'destructive';
}): React.ReactElement {
  return <Badge variant={variant === 'destructive' ? 'destructive' : variant}>{label}</Badge>;
}
