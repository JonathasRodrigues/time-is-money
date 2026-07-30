'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBrlFromCents } from '@tim/domain';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  '#3d6b8a',
  '#7a8f6b',
  '#8a6b5b',
];

function currencyTick(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

function tooltipStyle(): React.CSSProperties {
  return {
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--card)',
    color: 'var(--card-foreground)',
    fontSize: 12,
  };
}

function tooltipItemStyle(): React.CSSProperties {
  return { color: 'var(--card-foreground)' };
}

function tooltipLabelStyle(): React.CSSProperties {
  return { color: 'var(--muted-foreground)', marginBottom: 4 };
}

export function ExpenseByCategoryChart({
  data,
}: {
  data: Array<{ name: string; amountCents: number }>;
}): React.ReactElement {
  const chartData = data.map((d) => ({
    name: d.name,
    value: d.amountCents / 100,
  }));

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem despesas neste mês.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickFormatter={currencyTick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | string) =>
              formatBrlFromCents(Math.round(Number(value) * 100))
            }
            contentStyle={tooltipStyle()}
            itemStyle={tooltipItemStyle()}
            labelStyle={tooltipLabelStyle()}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {chartData.map((_, index) => (
              <Cell
                key={chartData[index]?.name ?? index}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDonutChart({
  data,
}: {
  data: Array<{ name: string; amountCents: number }>;
}): React.ReactElement {
  const chartData = data.map((d) => ({
    name: d.name,
    value: d.amountCents / 100,
  }));
  const total = chartData.reduce((acc, row) => acc + row.value, 0);

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem despesas neste mês.</p>;
  }

  return (
    <div className="relative h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string) =>
              formatBrlFromCents(Math.round(Number(value) * 100))
            }
            contentStyle={tooltipStyle()}
            itemStyle={tooltipItemStyle()}
            labelStyle={tooltipLabelStyle()}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatBrlFromCents(Math.round(total * 100))}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CashflowTrendChart({
  data,
}: {
  data: Array<{ label: string; incomeCents: number; expenseCents: number }>;
}): React.ReactElement {
  const chartData = data.map((d) => ({
    label: d.label,
    receitas: d.incomeCents / 100,
    despesas: d.expenseCents / 100,
    saldo: (d.incomeCents - d.expenseCents) / 100,
  }));

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickFormatter={currencyTick}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value: number | string) =>
              formatBrlFromCents(Math.round(Number(value) * 100))
            }
            contentStyle={tooltipStyle()}
            itemStyle={tooltipItemStyle()}
            labelStyle={tooltipLabelStyle()}
          />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value) => <span className="text-xs capitalize">{value}</span>}
          />
          <Area
            type="monotone"
            dataKey="receitas"
            stroke="var(--primary)"
            fill="url(#incomeFill)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="despesas"
            stroke="var(--chart-5)"
            fill="url(#expenseFill)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="saldo"
            stroke="var(--chart-2)"
            fill="transparent"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceBarsChart({
  data,
}: {
  data: Array<{ label: string; balanceCents: number }>;
}): React.ReactElement {
  const chartData = data.map((d) => ({
    label: d.label,
    saldo: d.balanceCents / 100,
  }));

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickFormatter={currencyTick}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value: number | string) =>
              formatBrlFromCents(Math.round(Number(value) * 100))
            }
            contentStyle={tooltipStyle()}
            itemStyle={tooltipItemStyle()}
            labelStyle={tooltipLabelStyle()}
          />
          <Bar dataKey="saldo" radius={[6, 6, 0, 0]}>
            {chartData.map((row) => (
              <Cell
                key={row.label}
                fill={row.saldo >= 0 ? 'var(--chart-1)' : 'var(--destructive)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Compara líquido disponível, obrigações e folga/falta no radar de caixa. */
export function CashCoverageChart({
  liquidCents,
  obligationsCents,
  gapCents,
}: {
  liquidCents: number;
  obligationsCents: number;
  gapCents: number;
}): React.ReactElement {
  const chartData = [
    { name: 'Líquido', value: liquidCents / 100, tone: 'liquid' as const },
    { name: 'A vencer', value: obligationsCents / 100, tone: 'due' as const },
    {
      name: gapCents >= 0 ? 'Folga' : 'Falta',
      value: Math.abs(gapCents) / 100,
      tone: gapCents >= 0 ? ('gap' as const) : ('short' as const),
    },
  ];

  const fillFor = (tone: (typeof chartData)[number]['tone']): string => {
    if (tone === 'liquid') return 'var(--chart-1)';
    if (tone === 'due') return 'var(--chart-5)';
    if (tone === 'short') return 'var(--destructive)';
    return 'var(--primary)';
  };

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickFormatter={currencyTick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={72}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | string) =>
              formatBrlFromCents(Math.round(Number(value) * 100))
            }
            contentStyle={tooltipStyle()}
            itemStyle={tooltipItemStyle()}
            labelStyle={tooltipLabelStyle()}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {chartData.map((row) => (
              <Cell key={row.name} fill={fillFor(row.tone)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Composição das obrigações (faturas / a pagar / financiamentos). */
export function ObligationBreakdownChart({
  invoicesCents,
  payablesCents,
  financingCents,
}: {
  invoicesCents: number;
  payablesCents: number;
  financingCents: number;
}): React.ReactElement {
  const chartData = [
    { name: 'Faturas', value: invoicesCents / 100 },
    { name: 'A pagar', value: payablesCents / 100 },
    { name: 'Financiam.', value: financingCents / 100 },
  ].filter((row) => row.value > 0);

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem obrigações no período.</p>;
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickFormatter={currencyTick}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value: number | string) =>
              formatBrlFromCents(Math.round(Number(value) * 100))
            }
            contentStyle={tooltipStyle()}
            itemStyle={tooltipItemStyle()}
            labelStyle={tooltipLabelStyle()}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {chartData.map((row, index) => (
              <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Mix de saída: conta à vista vs cartão de crédito. */
export function PaymentMixChart({
  buckets,
}: {
  buckets: Array<{ key: string; label: string; amountCents: number; sharePct: number }>;
}): React.ReactElement {
  const chartData = buckets.map((bucket) => ({
    key: bucket.key,
    name: bucket.key === 'credit_card' ? 'Crédito' : 'Conta',
    value: bucket.amountCents / 100,
    sharePct: bucket.sharePct,
  }));
  const total = chartData.reduce((acc, row) => acc + row.value, 0);

  if (chartData.length === 0 || total <= 0) {
    return <p className="text-sm text-muted-foreground">Sem despesas no período.</p>;
  }

  const fillFor = (key: string): string =>
    key === 'credit_card' ? 'var(--chart-5)' : 'var(--chart-1)';

  return (
    <div className="relative h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {chartData.map((row) => (
              <Cell key={row.key} fill={fillFor(row.key)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string, name: string) => [
              formatBrlFromCents(Math.round(Number(value) * 100)),
              name,
            ]}
            contentStyle={tooltipStyle()}
            itemStyle={tooltipItemStyle()}
            labelStyle={tooltipLabelStyle()}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <p className="text-xs text-muted-foreground">Total</p>
        <p className="text-sm font-semibold tabular-nums">
          {formatBrlFromCents(Math.round(total * 100))}
        </p>
      </div>
    </div>
  );
}

/** Progresso das metas no bloco de planejamento. */
export function PlanProgressChart({
  plans,
}: {
  plans: Array<{ name: string; progressPct: number; isComplete: boolean; isOverdue: boolean }>;
}): React.ReactElement {
  const chartData = plans.slice(0, 5).map((plan) => ({
    name: plan.name.length > 14 ? `${plan.name.slice(0, 13)}…` : plan.name,
    progresso: plan.progressPct,
    tone: plan.isComplete ? 'done' : plan.isOverdue ? 'late' : 'open',
  }));

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>;
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickFormatter={(value: number) => `${value}%`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | string) => [`${Number(value)}%`, 'Progresso']}
            contentStyle={tooltipStyle()}
            itemStyle={tooltipItemStyle()}
            labelStyle={tooltipLabelStyle()}
          />
          <Bar dataKey="progresso" radius={[0, 6, 6, 0]}>
            {chartData.map((row) => (
              <Cell
                key={row.name}
                fill={
                  row.tone === 'done'
                    ? 'var(--primary)'
                    : row.tone === 'late'
                      ? 'var(--destructive)'
                      : 'var(--chart-2)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
