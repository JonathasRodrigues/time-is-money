'use client';

import { useState } from 'react';
import { formatBrlFromCents, type AttentionSignal } from '@tim/domain';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const KIND_LABEL: Record<AttentionSignal['kind'], string> = {
  spike: 'Alta',
  drop: 'Queda',
  rebound: 'Pico e retorno',
  sustained_rise: 'Alta sustentada',
  vs_average: 'Acima da média',
  new_category: 'Gasto novo',
};

function severityStyles(severity: AttentionSignal['severity']): {
  badge: 'destructive' | 'secondary' | 'outline';
  bar: string;
  icon: string;
} {
  if (severity === 'critical') {
    return {
      badge: 'destructive',
      bar: 'bg-destructive',
      icon: 'text-destructive',
    };
  }
  if (severity === 'warning') {
    return {
      badge: 'secondary',
      bar: 'bg-[var(--tim-warning)]',
      icon: 'text-[var(--tim-warning)]',
    };
  }
  if (severity === 'positive') {
    return {
      badge: 'outline',
      bar: 'bg-primary',
      icon: 'text-primary',
    };
  }
  return {
    badge: 'outline',
    bar: 'bg-muted-foreground/50',
    icon: 'text-muted-foreground',
  };
}

function KindIcon({
  kind,
  className,
}: {
  kind: AttentionSignal['kind'];
  className?: string;
}): React.ReactElement {
  if (kind === 'drop') return <ArrowDownRight className={className} />;
  if (kind === 'rebound') return <RotateCcw className={className} />;
  if (kind === 'sustained_rise' || kind === 'vs_average') {
    return <TrendingUp className={className} />;
  }
  if (kind === 'new_category') return <Sparkles className={className} />;
  return <ArrowUpRight className={className} />;
}

function MiniSparkline({
  series,
  tone,
}: {
  series: AttentionSignal['series'];
  tone: AttentionSignal['severity'];
}): React.ReactElement {
  const stroke =
    tone === 'positive'
      ? 'var(--primary)'
      : tone === 'critical'
        ? 'var(--destructive)'
        : tone === 'warning'
          ? 'var(--tim-warning)'
          : 'var(--chart-2)';
  const data = series.map((point) => ({
    label: point.label,
    value: point.amountCents / 100,
  }));
  const gradientId = `attn-${tone}-${series.map((p) => p.amountCents).join('-')}`;

  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Tooltip
            formatter={(value: number | string) =>
              formatBrlFromCents(Math.round(Number(value) * 100))
            }
            labelFormatter={(label) => String(label)}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: stroke }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AttentionPointsPanel({
  signals,
}: {
  signals: AttentionSignal[];
}): React.ReactElement {
  const [selectedId, setSelectedId] = useState(signals[0]?.id ?? null);
  const selected = signals.find((signal) => signal.id === selectedId) ?? signals[0] ?? null;

  if (signals.length === 0) {
    return (
      <Card className="gap-4 py-5">
        <CardHeader className="px-5 pb-0">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-primary" />
            Pontos de atenção
          </CardTitle>
          <CardDescription>Variações relevantes por categoria nos últimos meses</CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <p className="text-sm text-muted-foreground">
            Sem desvios relevantes na janela. Quando uma categoria disparar ou cair de forma atípica
            (ex.: supermercado 1.000 → 1.500 → 1.000), aparece aqui com o histórico.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-[var(--tim-warning)]" />
              Pontos de atenção
            </CardTitle>
            <CardDescription>
              Mudanças atípicas de gasto por categoria · {signals.length} sinal
              {signals.length === 1 ? '' : 'is'}
            </CardDescription>
          </div>
          <Badge variant="secondary">Análise mensal</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-0 p-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="divide-y border-b lg:border-r lg:border-b-0">
          {signals.slice(0, 6).map((signal) => {
            const styles = severityStyles(signal.severity);
            const active = selected?.id === signal.id;
            return (
              <button
                key={signal.id}
                type="button"
                onClick={() => setSelectedId(signal.id)}
                className={cn(
                  'relative flex w-full flex-col gap-2 px-4 py-3.5 text-left transition',
                  active ? 'bg-muted/50' : 'hover:bg-muted/30',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0 bottom-0 left-0 w-0.5',
                    active ? styles.bar : 'bg-transparent',
                  )}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <KindIcon kind={signal.kind} className={cn('size-3.5', styles.icon)} />
                      <p className="truncate text-sm font-semibold">{signal.title}</p>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {signal.detail}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={styles.badge} className="mb-1">
                      {KIND_LABEL[signal.kind]}
                    </Badge>
                    <p
                      className={cn(
                        'text-xs font-medium tabular-nums',
                        signal.deltaCents >= 0 ? 'text-destructive' : 'text-primary',
                      )}
                    >
                      {signal.deltaPct === null
                        ? formatBrlFromCents(Math.abs(signal.deltaCents))
                        : `${signal.deltaPct >= 0 ? '+' : ''}${Math.round(signal.deltaPct * 100)}%`}
                    </p>
                  </div>
                </div>
                <MiniSparkline series={signal.series} tone={signal.severity} />
              </button>
            );
          })}
        </div>

        {selected ? (
          <div className="flex flex-col gap-4 p-5">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Detalhe
              </p>
              <h3 className="text-lg font-semibold tracking-tight">{selected.categoryName}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{selected.detail}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {selected.series.slice(-3).map((point) => (
                <div key={point.monthKey} className="rounded-lg border bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {point.label}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatBrlFromCents(point.amountCents)}
                  </p>
                </div>
              ))}
            </div>
            <div className="h-40 rounded-lg border bg-muted/20 p-2">
              <MiniSparkline series={selected.series} tone={selected.severity} />
            </div>
            <p className="text-xs text-muted-foreground">
              Use isso para revisar se o desvio foi pontual (viagem, estoque) ou se virou novo
              patamar de gasto.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
