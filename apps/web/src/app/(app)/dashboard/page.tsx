export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import {
  analyzeCategoryAttention,
  estimateMonthlyYieldCents,
  formatBrlFromCents,
  formatIsoDateBr,
  formatYieldLabel,
  type YieldType,
} from '@tim/domain';
import { accounts, categories, costCenters, financings, installments, transactions } from '@tim/db';
import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { AttentionPointsPanel } from '@/components/attention-points';
import {
  BalanceBarsChart,
  CashflowTrendChart,
  CategoryDonutChart,
  ExpenseByCategoryChart,
} from '@/components/charts';
import { InsightItem, KpiCard, SectionLink, StatusBadge } from '@/components/dashboard-widgets';
import { ScopeFilters } from '@/components/scope-filters';
import {
  buildScopeHref,
  daysBetweenInclusive,
  monthBounds,
  previousRangeOfSameLength,
  resolveCostCenterId,
  resolveDateRange,
  shiftMonth,
} from '@/lib/scope-query';
import { PageHeader } from '@/components/page-header';
import { DashboardPageSkeleton } from '@/components/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAuthSession, getDb } from '@/server/db';
import type { SQL } from 'drizzle-orm';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return iso;
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function deltaLabel(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? 'sem variação' : 'sem base anterior';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}% vs período anterior`;
}

type SearchParams = { center?: string; period?: string; from?: string; to?: string };

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): React.ReactElement {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DashboardView searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardView({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');

  const db = getDb();
  const params = await searchParams;
  const now = new Date();
  const today = todayIso();
  const weekEnd = addDaysIso(today, 7);
  const range = resolveDateRange(params, now);
  const prev = previousRangeOfSameLength(range);
  const { start, end } = range;
  const elapsedEnd = end > today ? today : end;
  const elapsedDays = daysBetweenInclusive(start, elapsedEnd);
  const rangeDays = daysBetweenInclusive(start, end);

  const centers = await db
    .select()
    .from(costCenters)
    .where(eq(costCenters.householdId, session.householdId));
  const centerId = resolveCostCenterId(params.center, new Set(centers.map((center) => center.id)));
  const activeCenterName = centerId
    ? (centers.find((center) => center.id === centerId)?.name ?? null)
    : null;

  const txFilters = (...extra: Array<SQL | undefined>) =>
    and(
      eq(transactions.householdId, session.householdId),
      isNull(transactions.deletedAt),
      eq(transactions.status, 'paid'),
      centerId ? eq(transactions.costCenterId, centerId) : undefined,
      ...extra,
    );

  const [periodTx, prevPeriodTx, cats, fins, allPendingRaw, recentTx, accountRows] =
    await Promise.all([
      db
        .select()
        .from(transactions)
        .where(txFilters(gte(transactions.occurredOn, start), lte(transactions.occurredOn, end))),
      db
        .select({
          type: transactions.type,
          total: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
        })
        .from(transactions)
        .where(
          txFilters(
            gte(transactions.occurredOn, prev.start),
            lte(transactions.occurredOn, prev.end),
          ),
        )
        .groupBy(transactions.type),
      db.select().from(categories).where(eq(categories.householdId, session.householdId)),
      db
        .select()
        .from(financings)
        .where(
          and(
            eq(financings.householdId, session.householdId),
            isNull(financings.deletedAt),
            centerId ? eq(financings.costCenterId, centerId) : undefined,
          ),
        ),
      db
        .select()
        .from(installments)
        .where(
          and(
            eq(installments.householdId, session.householdId),
            eq(installments.status, 'pending'),
          ),
        )
        .orderBy(asc(installments.dueOn)),
      db
        .select()
        .from(transactions)
        .where(txFilters(gte(transactions.occurredOn, start), lte(transactions.occurredOn, end)))
        .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
        .limit(8),
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.householdId, session.householdId),
            eq(accounts.isArchived, false),
            centerId ? eq(accounts.costCenterId, centerId) : undefined,
          ),
        ),
    ]);

  const finIds = new Set(fins.map((financing) => financing.id));
  const allPending = centerId
    ? allPendingRaw.filter((item) => finIds.has(item.financingId))
    : allPendingRaw;

  const income = periodTx
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + (t.amountCents ?? 0), 0);
  const expense = periodTx
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + (t.amountCents ?? 0), 0);
  const balance = income - expense;
  const savingsRate = income === 0 ? null : (balance / income) * 100;
  const avgDailySpend = Math.round(expense / elapsedDays);
  const projectedExpense = Math.round(avgDailySpend * rangeDays);

  const prevIncome = Number(prevPeriodTx.find((r) => r.type === 'income')?.total ?? 0);
  const prevExpense = Number(prevPeriodTx.find((r) => r.type === 'expense')?.total ?? 0);
  const prevBalance = prevIncome - prevExpense;

  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const finMap = new Map(fins.map((f) => [f.id, f]));

  const byCategory = Object.entries(
    periodTx
      .filter((t) => t.type === 'expense')
      .reduce<Record<string, number>>((acc, t) => {
        const name = catMap.get(t.categoryId) ?? 'Outros';
        acc[name] = (acc[name] ?? 0) + (t.amountCents ?? 0);
        return acc;
      }, {}),
  )
    .map(([name, amountCents]) => ({ name, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 8);

  const byCenter = Object.entries(
    periodTx
      .filter((t) => t.type === 'expense')
      .reduce<Record<string, number>>((acc, t) => {
        const name = centerMap.get(t.costCenterId) ?? '—';
        acc[name] = (acc[name] ?? 0) + (t.amountCents ?? 0);
        return acc;
      }, {}),
  )
    .map(([name, amountCents]) => ({ name, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);

  const overdue = allPending.filter((i) => i.dueOn < today);
  const dueThisWeek = allPending.filter((i) => i.dueOn >= today && i.dueOn <= weekEnd);
  const upcoming = allPending.filter((i) => i.dueOn >= today).slice(0, 8);
  const upcomingTotal = upcoming.reduce((acc, item) => acc + item.amountCents, 0);
  const overdueTotal = overdue.reduce((acc, item) => acc + item.amountCents, 0);

  const debtRemaining = allPending.reduce((acc, item) => acc + item.amountCents, 0);

  const wealthTotal = accountRows.reduce((sum, row) => sum + row.balanceCents, 0);
  const wealthInvested = accountRows
    .filter((row) => row.kind === 'investment_pot')
    .reduce((sum, row) => sum + row.balanceCents, 0);
  const wealthLiquid = wealthTotal - wealthInvested;
  const wealthMonthlyYield = accountRows.reduce(
    (sum, row) =>
      sum +
      estimateMonthlyYieldCents({
        balanceCents: row.balanceCents,
        yieldType: row.yieldType as YieldType,
        yieldBps: row.yieldBps,
      }),
    0,
  );
  const yieldingAccounts = accountRows
    .filter((row) => row.yieldType !== 'none' && row.balanceCents > 0)
    .map((row) => ({
      ...row,
      monthlyYieldCents: estimateMonthlyYieldCents({
        balanceCents: row.balanceCents,
        yieldType: row.yieldType as YieldType,
        yieldBps: row.yieldBps,
      }),
    }))
    .sort((a, b) => b.monthlyYieldCents - a.monthlyYieldCents)
    .slice(0, 5);

  const financingCards = fins.map((financing) => {
    const parcels = allPending.filter((i) => i.financingId === financing.id);
    const remaining = parcels.reduce((acc, i) => acc + i.amountCents, 0);
    const next = parcels[0];
    const paidCount = financing.installmentCount - parcels.length;
    const progress =
      financing.installmentCount === 0 ? 0 : (paidCount / financing.installmentCount) * 100;
    return { financing, remaining, next, paidCount, progress };
  });

  const trendMonthsCount =
    range.period === 'last_3m'
      ? 3
      : range.period === 'ytd'
        ? Math.min(12, now.getUTCMonth() + 1)
        : 6;
  const rangeEndMonth = new Date(`${end}T00:00:00.000Z`);
  const trendMonths = Array.from({ length: trendMonthsCount }, (_, index) =>
    monthBounds(shiftMonth(rangeEndMonth, index - (trendMonthsCount - 1))),
  );
  const trendStart = trendMonths[0]?.start;
  const trendEnd = trendMonths[trendMonths.length - 1]?.end;
  const trendTx =
    trendStart && trendEnd
      ? await db
          .select({
            occurredOn: transactions.occurredOn,
            type: transactions.type,
            amountCents: transactions.amountCents,
          })
          .from(transactions)
          .where(
            txFilters(
              gte(transactions.occurredOn, trendStart),
              lte(transactions.occurredOn, trendEnd),
            ),
          )
      : [];

  const trend = trendMonths.map((month) => {
    const inMonth = trendTx.filter((t) => t.occurredOn >= month.start && t.occurredOn <= month.end);
    const incomeCents = inMonth
      .filter((t) => t.type === 'income')
      .reduce((acc, t) => acc + (t.amountCents ?? 0), 0);
    const expenseCents = inMonth
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + (t.amountCents ?? 0), 0);
    return {
      label: month.label.replace('.', ''),
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
    };
  });

  const attentionMonths = Array.from({ length: 6 }, (_, index) => {
    const bounds = monthBounds(shiftMonth(new Date(`${end}T00:00:00.000Z`), index - 5));
    return {
      key: bounds.start.slice(0, 7),
      label: bounds.label.replace('.', ''),
      start: bounds.start,
      end: bounds.end,
    };
  });
  const attentionStart = attentionMonths[0]?.start;
  const attentionEnd = attentionMonths[attentionMonths.length - 1]?.end;
  const attentionTx =
    attentionStart && attentionEnd
      ? await db
          .select({
            occurredOn: transactions.occurredOn,
            categoryId: transactions.categoryId,
            amountCents: transactions.amountCents,
          })
          .from(transactions)
          .where(
            txFilters(
              eq(transactions.type, 'expense'),
              gte(transactions.occurredOn, attentionStart),
              lte(transactions.occurredOn, attentionEnd),
            ),
          )
      : [];

  const seriesByCategory: Record<string, number[]> = {};
  for (const cat of cats.filter((c) => c.type === 'expense')) {
    seriesByCategory[cat.name] = attentionMonths.map((month) =>
      attentionTx
        .filter(
          (t) =>
            t.categoryId === cat.id && t.occurredOn >= month.start && t.occurredOn <= month.end,
        )
        .reduce((acc, t) => acc + (t.amountCents ?? 0), 0),
    );
  }

  const attentionSignals = analyzeCategoryAttention({
    months: attentionMonths.map(({ key, label }) => ({ key, label })),
    seriesByCategory,
  }).slice(0, 8);

  const topCategory = byCategory[0];
  const expenseShare = income === 0 ? null : Math.min(100, Math.round((expense / income) * 100));

  const insights: Array<{
    title: string;
    detail: string;
    tone: 'neutral' | 'good' | 'warn' | 'bad';
  }> = [];

  if (overdue.length > 0) {
    insights.push({
      title: `${overdue.length} parcela${overdue.length > 1 ? 's' : ''} em atraso`,
      detail: `${formatBrlFromCents(overdueTotal)} vencidos antes de hoje`,
      tone: 'bad',
    });
  }
  if (dueThisWeek.length > 0) {
    insights.push({
      title: `${dueThisWeek.length} vencimento${dueThisWeek.length > 1 ? 's' : ''} nesta semana`,
      detail: formatBrlFromCents(dueThisWeek.reduce((acc, item) => acc + item.amountCents, 0)),
      tone: 'warn',
    });
  }
  if (savingsRate !== null) {
    insights.push({
      title:
        savingsRate >= 20
          ? 'Poupança saudável'
          : savingsRate >= 0
            ? 'Poupança apertada'
            : 'Período no vermelho',
      detail:
        savingsRate >= 0
          ? `Taxa de ${savingsRate.toFixed(1)}% da receita`
          : `Déficit de ${formatBrlFromCents(Math.abs(balance))}`,
      tone: savingsRate >= 20 ? 'good' : savingsRate >= 0 ? 'warn' : 'bad',
    });
  }
  if (wealthMonthlyYield > 0) {
    insights.push({
      title: 'Rendimento estimado',
      detail: `~${formatBrlFromCents(wealthMonthlyYield)}/mês em caixinhas e investimentos`,
      tone: 'good',
    });
  }
  if (wealthInvested > 0 && wealthTotal > 0) {
    const investShare = Math.round((wealthInvested / wealthTotal) * 100);
    insights.push({
      title: `${investShare}% do patrimônio investido`,
      detail: `${formatBrlFromCents(wealthInvested)} em caixinhas · ${formatBrlFromCents(wealthLiquid)} líquido`,
      tone: 'neutral',
    });
  }
  if (topCategory) {
    const share = expense === 0 ? 0 : (topCategory.amountCents / expense) * 100;
    insights.push({
      title: `Maior gasto: ${topCategory.name}`,
      detail: `${formatBrlFromCents(topCategory.amountCents)} · ${share.toFixed(0)}% das despesas`,
      tone: share >= 40 ? 'warn' : 'neutral',
    });
  }
  if (projectedExpense > 0 && income > 0 && range.period === 'this_month') {
    insights.push({
      title: 'Projeção de despesa no mês',
      detail: `${formatBrlFromCents(projectedExpense)} no ritmo atual (${formatBrlFromCents(avgDailySpend)}/dia)`,
      tone: projectedExpense > income ? 'bad' : 'neutral',
    });
  }
  if (insights.length === 0) {
    insights.push({
      title: 'Sem sinais críticos',
      detail: 'Continue registrando movimentos no extrato para enriquecer os insights.',
      tone: 'neutral',
    });
  }

  const scopeLabel = [range.label, activeCenterName].filter(Boolean).join(' · ');
  const scopeQuery = {
    center: centerId,
    period: range.period,
    from: params.from,
    to: params.to,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Base: ${scopeLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="tabular-nums">
              {periodTx.length} movimentos
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {fins.length} financiamentos
            </Badge>
          </div>
        }
      />

      <ScopeFilters
        centers={centers.map((center) => ({ id: center.id, name: center.name }))}
        activeCenterId={centerId}
        range={range}
        basePath="/dashboard"
        customFrom={params.from}
        customTo={params.to}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard
          label="Receitas"
          value={formatBrlFromCents(income)}
          hint={deltaLabel(income, prevIncome)}
          tone={income >= prevIncome ? 'positive' : 'negative'}
          size="lg"
        />
        <KpiCard
          label="Despesas"
          value={formatBrlFromCents(expense)}
          hint={deltaLabel(expense, prevExpense)}
          tone={expense <= prevExpense ? 'positive' : 'negative'}
          size="lg"
        />
        <KpiCard
          label="Saldo do período"
          value={formatBrlFromCents(balance)}
          hint={deltaLabel(balance, prevBalance)}
          tone={balance < 0 ? 'negative' : 'positive'}
          size="lg"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Taxa de poupança"
          value={savingsRate === null ? '—' : `${savingsRate.toFixed(1)}%`}
          hint={
            expenseShare === null
              ? 'Sem receita no período'
              : `${expenseShare}% da receita comprometida`
          }
          tone={
            savingsRate === null
              ? 'default'
              : savingsRate >= 20
                ? 'positive'
                : savingsRate < 0
                  ? 'negative'
                  : 'default'
          }
        />
        <KpiCard
          label="Média diária de gasto"
          value={formatBrlFromCents(avgDailySpend)}
          hint={
            range.period === 'this_month'
              ? `Projeção mês: ${formatBrlFromCents(projectedExpense)}`
              : `${elapsedDays} dias na base`
          }
        />
        <KpiCard
          label="Dívida restante"
          value={formatBrlFromCents(debtRemaining)}
          hint={`${allPending.length} parcelas pendentes`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Patrimônio"
          value={formatBrlFromCents(wealthTotal)}
          hint={`${accountRows.length} contas · saldo informado`}
          size="lg"
        />
        <KpiCard
          label="Investido / caixinhas"
          value={formatBrlFromCents(wealthInvested)}
          hint={
            wealthTotal > 0
              ? `${Math.round((wealthInvested / wealthTotal) * 100)}% do patrimônio`
              : 'Sem saldos cadastrados'
          }
          tone={wealthInvested > 0 ? 'positive' : 'default'}
          size="lg"
        />
        <KpiCard
          label="Rendimento mensal est."
          value={formatBrlFromCents(wealthMonthlyYield)}
          hint={
            wealthMonthlyYield > 0
              ? `Líquido em conta: ${formatBrlFromCents(wealthLiquid)}`
              : 'Cadastre % CDI ou taxa nas contas'
          }
          tone={wealthMonthlyYield > 0 ? 'positive' : 'default'}
          size="lg"
        />
      </div>

      <Card className="gap-4 py-5">
        <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
          <div>
            <CardTitle>Onde o dinheiro rende</CardTitle>
            <CardDescription>
              Caixinhas e investimentos com rendimento · estimativa CDI ref. 13,15% a.a.
            </CardDescription>
          </div>
          <SectionLink href="/wealth" label="Ver patrimônio" />
        </CardHeader>
        <CardContent className="px-5">
          {yieldingAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma caixinha com rendimento ainda. Cadastre em Patrimônio / Bancos e contas.
            </p>
          ) : (
            <div className="divide-y">
              {yieldingAccounts.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatYieldLabel(row.yieldType as YieldType, row.yieldBps)}
                      {' · '}
                      saldo {formatBrlFromCents(row.balanceCents)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-primary">
                    ~{formatBrlFromCents(row.monthlyYieldCents)}
                    <span className="font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AttentionPointsPanel signals={attentionSignals} />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="gap-4 py-5">
          <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
            <div>
              <CardTitle>Fluxo no tempo</CardTitle>
              <CardDescription>Receitas, despesas e saldo</CardDescription>
            </div>
            <SectionLink href={buildScopeHref('/transactions', scopeQuery)} label="Ver extrato" />
          </CardHeader>
          <CardContent className="px-5">
            <CashflowTrendChart data={trend} />
          </CardContent>
        </Card>
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Distribuição do período</CardTitle>
            <CardDescription>Despesas por categoria</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <CategoryDonutChart data={byCategory} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-4 py-5 lg:col-span-1">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Sinais do período</CardTitle>
            <CardDescription>Alertas e leituras rápidas</CardDescription>
          </CardHeader>
          <CardContent className="divide-y px-5">
            {insights.slice(0, 5).map((item) => (
              <InsightItem
                key={`${item.title}-${item.detail}`}
                title={item.title}
                detail={item.detail}
                tone={item.tone}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="gap-4 py-5 lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
            <div>
              <CardTitle>Saúde dos financiamentos</CardTitle>
              <CardDescription>Restante a pagar · progresso · próxima parcela</CardDescription>
            </div>
            <SectionLink
              href={buildScopeHref('/financings', { center: centerId })}
              label="Gerenciar"
            />
          </CardHeader>
          <CardContent className="divide-y px-5">
            {financingCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum financiamento ativo. Simule Price/SAC em Financiamentos.
              </p>
            ) : (
              financingCards.map(({ financing, remaining, next, paidCount, progress }) => (
                <div key={financing.id} className="space-y-2.5 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{financing.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {financing.institution ?? 'Sem instituição'} ·{' '}
                        {financing.amortizationSystem.toUpperCase()} · {paidCount}/
                        {financing.installmentCount} pagas
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatBrlFromCents(remaining)}
                      </p>
                      <p className="text-xs text-muted-foreground">restante</p>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{progress.toFixed(0)}% quitado</span>
                    <span className="tabular-nums">
                      {next
                        ? `Próxima: ${formatIsoDateBr(next.dueOn)} · ${formatBrlFromCents(next.amountCents)}`
                        : 'Quitado'}
                    </span>
                  </div>
                </div>
              ))
            )}
            {upcomingTotal > 0 ? (
              <p className="pt-3 text-xs text-muted-foreground">
                Próximas parcelas no radar: {formatBrlFromCents(upcomingTotal)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Ranking de categorias</CardTitle>
            <CardDescription>Onde mais saiu dinheiro neste período</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ExpenseByCategoryChart data={byCategory} />
          </CardContent>
        </Card>
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Saldo mensal</CardTitle>
            <CardDescription>Resultado líquido por mês na janela</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <BalanceBarsChart
              data={trend.map((row) => ({
                label: row.label,
                balanceCents: row.balanceCents,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Por centro de custo</CardTitle>
            <CardDescription>Composição das despesas do período</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5">
            {byCenter.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
            ) : (
              byCenter.map((center) => {
                const pct = expense === 0 ? 0 : (center.amountCents / expense) * 100;
                return (
                  <div key={center.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{center.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatBrlFromCents(center.amountCents)} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
            <div>
              <CardTitle>Vencimentos</CardTitle>
              <CardDescription>
                {overdue.length > 0
                  ? `${overdue.length} em atraso · próximas no horizonte`
                  : 'Parcelas pendentes no horizonte'}
              </CardDescription>
            </div>
            <SectionLink href={buildScopeHref('/financings', { center: centerId })} label="Pagar" />
          </CardHeader>
          <CardContent className="px-0 sm:px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.length === 0 && overdue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      Nenhuma parcela pendente.
                    </TableCell>
                  </TableRow>
                ) : null}
                {[...overdue, ...upcoming]
                  .filter(
                    (item, index, arr) =>
                      arr.findIndex((candidate) => candidate.id === item.id) === index,
                  )
                  .slice(0, 8)
                  .map((item) => {
                    const isOverdue = item.dueOn < today;
                    const isSoon = !isOverdue && item.dueOn <= weekEnd;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {finMap.get(item.financingId)?.name ?? 'Financiamento'}
                          <span className="ml-1 text-xs text-muted-foreground">#{item.number}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            label={isOverdue ? 'atraso' : isSoon ? 'esta semana' : 'agendada'}
                            variant={isOverdue ? 'destructive' : isSoon ? 'secondary' : 'outline'}
                          />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatIsoDateBr(item.dueOn)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatBrlFromCents(item.amountCents)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-4 py-5">
        <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
          <div>
            <CardTitle>Últimos movimentos</CardTitle>
            <CardDescription>Movimentação recente do household</CardDescription>
          </div>
          <SectionLink href={buildScopeHref('/transactions', scopeQuery)} label="Ver todos" />
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTx.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    Nenhum movimento ainda.
                  </TableCell>
                </TableRow>
              ) : (
                recentTx.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatIsoDateBr(row.occurredOn)}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate font-medium">
                      {row.description || catMap.get(row.categoryId) || 'Lançamento'}
                    </TableCell>
                    <TableCell>{centerMap.get(row.costCenterId) ?? '—'}</TableCell>
                    <TableCell>{catMap.get(row.categoryId) ?? '—'}</TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        row.type === 'income' ? 'text-primary' : ''
                      }`}
                    >
                      {row.type === 'income' ? '+' : '−'}
                      {formatBrlFromCents(row.amountCents ?? 0)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
