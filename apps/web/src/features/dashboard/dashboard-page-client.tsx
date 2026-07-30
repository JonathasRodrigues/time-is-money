'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardResponse } from '@tim/api-contract';
import { formatBrlFromCents, formatIsoDateBr, type AttentionSignal } from '@tim/domain';
import { AttentionPointsPanel } from '@/components/attention-points';
import {
  BalanceBarsChart,
  CashCoverageChart,
  CashflowTrendChart,
  CategoryDonutChart,
  ExpenseByCategoryChart,
  ObligationBreakdownChart,
  PaymentMixChart,
  PlanProgressChart,
} from '@/components/charts';
import { InsightItem, KpiCard, SectionLink, StatusBadge } from '@/components/dashboard-widgets';
import { PageHeader } from '@/components/page-header';
import { DashboardPageSkeleton } from '@/components/page-skeletons';
import { QueryBoundary } from '@/components/query-boundary';
import { ScopeFilters } from '@/components/scope-filters';
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
import { useSearchParamsRecord } from '@/hooks/use-search-params-record';
import { api } from '@/lib/api/endpoints';
import { toDateRange, toPeriodKey } from '@/lib/api/period';
import { queryKeys } from '@/lib/api/query-keys';
import { buildScopeHref } from '@/lib/scope-query';

function DashboardContent({ data }: { data: DashboardResponse }): React.ReactElement {
  const {
    range,
    scopeLabel,
    scopeQuery,
    meta,
    kpis,
    yieldingAccounts,
    cashRadar,
    paymentMix,
    planning,
    attentionSignals,
    trend,
    byCategory,
    byCenter,
    insights,
    financingCards,
    upcomingTotalCents,
    dueInstallments,
    recentTransactions,
    lookups,
  } = data;

  const expenseCents = kpis.expense.cents;
  const wealth = kpis.wealth;
  const savingsRate = kpis.savingsRate;
  const investedShare =
    wealth.totalCents > 0 ? Math.round((wealth.investedCents / wealth.totalCents) * 100) : 0;

  const hrefQuery = {
    center: scopeQuery.center,
    period: toPeriodKey(scopeQuery.period),
    from: scopeQuery.from,
    to: scopeQuery.to,
  };

  const obligationKindLabel = {
    credit_card_invoice: 'Fatura',
    payable: 'A pagar',
    financing: 'Financiamento',
  } as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Base: ${scopeLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="tabular-nums">
              {meta.movementCount} movimentos
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {meta.financingCount} financiamentos
            </Badge>
          </div>
        }
      />

      <ScopeFilters
        centers={lookups.centers}
        activeCenterId={lookups.activeCenterId}
        range={toDateRange(range)}
        basePath="/dashboard"
        customFrom={lookups.customFrom}
        customTo={lookups.customTo}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard
          label="Receitas"
          value={formatBrlFromCents(kpis.income.cents)}
          hint={kpis.income.deltaLabel}
          tone={kpis.income.tone}
          size="lg"
        />
        <KpiCard
          label="Despesas"
          value={formatBrlFromCents(kpis.expense.cents)}
          hint={kpis.expense.deltaLabel}
          tone={kpis.expense.tone}
          size="lg"
        />
        <KpiCard
          label="Saldo do período"
          value={formatBrlFromCents(kpis.balance.cents)}
          hint={kpis.balance.deltaLabel}
          tone={kpis.balance.tone}
          size="lg"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Taxa de poupança"
          value={savingsRate.value === null ? '—' : `${savingsRate.value.toFixed(1)}%`}
          hint={savingsRate.hint}
          tone={savingsRate.tone}
        />
        <KpiCard
          label="Média diária de gasto"
          value={formatBrlFromCents(kpis.avgDailySpend.cents)}
          hint={kpis.avgDailySpend.hint}
        />
        <KpiCard
          label="Dívida restante"
          value={formatBrlFromCents(kpis.debtRemaining.cents)}
          hint={`${kpis.debtRemaining.pendingCount} parcelas pendentes`}
        />
      </div>

      {cashRadar.active ? (
        <Card className="gap-4 py-5">
          <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
            <div>
              <CardTitle>Radar de caixa</CardTitle>
              <CardDescription>
                Líquido vs vencimentos do período · {cashRadar.horizonLabel}
              </CardDescription>
            </div>
            <SectionLink href={buildScopeHref('/payments', hrefQuery)} label="Contas a pagar" />
          </CardHeader>
          <CardContent className="space-y-5 px-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Líquido nas contas</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatBrlFromCents(cashRadar.liquidCents)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">A vencer / atrasado</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatBrlFromCents(cashRadar.obligationsTotalCents)}
                </p>
                {cashRadar.overdueCents > 0 ? (
                  <p className="mt-0.5 text-xs text-destructive tabular-nums">
                    {formatBrlFromCents(cashRadar.overdueCents)} em atraso
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {cashRadar.gapCents >= 0 ? 'Folga após obrigações' : 'Falta de caixa'}
                </p>
                <p
                  className={`mt-1 text-lg font-semibold tabular-nums ${
                    cashRadar.gapCents < 0 ? 'text-destructive' : 'text-primary'
                  }`}
                >
                  {formatBrlFromCents(cashRadar.gapCents)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Cobertura de caixa</p>
                <CashCoverageChart
                  liquidCents={cashRadar.liquidCents}
                  obligationsCents={cashRadar.obligationsTotalCents}
                  gapCents={cashRadar.gapCents}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Onde está o compromisso</p>
                <ObligationBreakdownChart
                  invoicesCents={cashRadar.invoicesDueCents}
                  payablesCents={cashRadar.payablesDueCents}
                  financingCents={cashRadar.financingDueCents}
                />
              </div>
            </div>

            {cashRadar.obligations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma obrigação no período. Bom momento para reforçar reserva ou adiantar dívidas.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {cashRadar.obligations.map((item) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {obligationKindLabel[item.kind]} · {formatIsoDateBr(item.dueOn)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge label={item.statusLabel} variant={item.statusVariant} />
                      <p className="text-sm font-semibold tabular-nums">
                        {formatBrlFromCents(item.amountCents)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cashRadar.cards.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Cartões</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {cashRadar.cards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {card.name}
                          {card.lastFour ? (
                            <span className="text-muted-foreground"> ·••• {card.lastFour}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {card.dueOn
                            ? `Vence ${formatIsoDateBr(card.dueOn)}`
                            : 'Sem fatura aberta'}
                          {card.closesOn ? ` · fecha ${formatIsoDateBr(card.closesOn)}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatBrlFromCents(card.invoiceBalanceCents)}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatBrlFromCents(card.availableCents)} livre
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Patrimônio"
          value={formatBrlFromCents(wealth.totalCents)}
          hint={`${wealth.accountCount} contas · saldo informado`}
          size="lg"
        />
        <KpiCard
          label="Investido / caixinhas"
          value={formatBrlFromCents(wealth.investedCents)}
          hint={
            wealth.totalCents > 0 ? `${investedShare}% do patrimônio` : 'Sem saldos cadastrados'
          }
          tone={wealth.investedCents > 0 ? 'positive' : 'default'}
          size="lg"
        />
        <KpiCard
          label="Rendimento mensal est."
          value={formatBrlFromCents(wealth.monthlyYieldCents)}
          hint={
            wealth.monthlyYieldCents > 0
              ? `Líquido em conta: ${formatBrlFromCents(wealth.liquidCents)}`
              : 'Cadastre % CDI ou taxa nas contas'
          }
          tone={wealth.monthlyYieldCents > 0 ? 'positive' : 'default'}
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
                      {row.yieldLabel}
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

      <Card className="gap-4 py-5">
        <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
          <div>
            <CardTitle>Metas e planejamento</CardTitle>
            <CardDescription>
              Progresso das metas · aporte necessário para o prazo
              {planning.nextPlan
                ? ` · próxima: ${planning.nextPlan.name} (${formatIsoDateBr(planning.nextPlan.targetDate)})`
                : ''}
            </CardDescription>
          </div>
          <SectionLink href="/planning" label="Gerenciar" />
        </CardHeader>
        <CardContent className="space-y-5 px-5">
          {planning.plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma meta ainda. Crie viagens, reserva de quitação ou metas livres em Planejamento.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Meta total</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {formatBrlFromCents(planning.totalPlannedCents)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Já guardado</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
                    {formatBrlFromCents(planning.totalSavedCents)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Aporte / mês (ritmo)</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {planning.monthlyNeededTotalCents > 0
                      ? formatBrlFromCents(planning.monthlyNeededTotalCents)
                      : '—'}
                  </p>
                  {planning.totalRemainingCents > 0 ? (
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      faltam {formatBrlFromCents(planning.totalRemainingCents)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Progresso</p>
                  <PlanProgressChart plans={planning.plans} />
                </div>
                <div className="divide-y rounded-lg border">
                  {planning.plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.kindLabel} · {formatIsoDateBr(plan.targetDate)}
                          {plan.linkedAccountName ? ` · ${plan.linkedAccountName}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{plan.progressPct}%</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {plan.isComplete
                            ? 'concluída'
                            : plan.isOverdue
                              ? 'atrasada'
                              : plan.monthlyNeededCents != null
                                ? `~${formatBrlFromCents(plan.monthlyNeededCents)}/mês`
                                : formatBrlFromCents(plan.remainingCents)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AttentionPointsPanel signals={attentionSignals as AttentionSignal[]} />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="gap-4 py-5">
          <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
            <div>
              <CardTitle>Fluxo no tempo</CardTitle>
              <CardDescription>Receitas, despesas e saldo</CardDescription>
            </div>
            <SectionLink href={buildScopeHref('/transactions', hrefQuery)} label="Ver extrato" />
          </CardHeader>
          <CardContent className="px-5">
            <CashflowTrendChart data={trend} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="gap-4 py-5">
            <CardHeader className="px-5 pb-0">
              <CardTitle>Distribuição do período</CardTitle>
              <CardDescription>Despesas por categoria</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <CategoryDonutChart data={byCategory} />
            </CardContent>
          </Card>
          <Card className="gap-4 py-5">
            <CardHeader className="px-5 pb-0">
              <CardTitle>Como saiu o dinheiro</CardTitle>
              <CardDescription>Conta à vista vs cartão de crédito</CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <PaymentMixChart buckets={paymentMix.buckets} />
            </CardContent>
          </Card>
        </div>
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
              href={buildScopeHref('/financings', { center: scopeQuery.center })}
              label="Gerenciar"
            />
          </CardHeader>
          <CardContent className="divide-y px-5">
            {financingCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum financiamento ativo. Simule Price/SAC em Financiamentos.
              </p>
            ) : (
              financingCards.map((card) => (
                <div key={card.id} className="space-y-2.5 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.institution ?? 'Sem instituição'} ·{' '}
                        {card.amortizationSystem.toUpperCase()} · {card.paidCount}/
                        {card.installmentCount} pagas
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatBrlFromCents(card.remainingCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">restante</p>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, card.progressPct)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{card.progressPct.toFixed(0)}% quitado</span>
                    <span className="tabular-nums">
                      {card.nextDueOn && card.nextAmountCents != null
                        ? `Próxima: ${formatIsoDateBr(card.nextDueOn)} · ${formatBrlFromCents(card.nextAmountCents)}`
                        : 'Quitado'}
                    </span>
                  </div>
                </div>
              ))
            )}
            {upcomingTotalCents > 0 ? (
              <p className="pt-3 text-xs text-muted-foreground">
                Próximas parcelas no radar: {formatBrlFromCents(upcomingTotalCents)}
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
                const pct = expenseCents === 0 ? 0 : (center.amountCents / expenseCents) * 100;
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
              <CardDescription>Parcelas pendentes no horizonte</CardDescription>
            </div>
            <SectionLink
              href={buildScopeHref('/financings', { center: scopeQuery.center })}
              label="Pagar"
            />
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
                {dueInstallments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      Nenhuma parcela pendente.
                    </TableCell>
                  </TableRow>
                ) : (
                  dueInstallments.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.financingName}
                        <span className="ml-1 text-xs text-muted-foreground">#{item.number}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={item.statusLabel} variant={item.statusVariant} />
                      </TableCell>
                      <TableCell className="tabular-nums">{formatIsoDateBr(item.dueOn)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatBrlFromCents(item.amountCents)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
          <SectionLink href={buildScopeHref('/transactions', hrefQuery)} label="Ver todos" />
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
              {recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    Nenhum movimento ainda.
                  </TableCell>
                </TableRow>
              ) : (
                recentTransactions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatIsoDateBr(row.occurredOn)}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate font-medium">
                      {row.description || row.categoryName || 'Lançamento'}
                    </TableCell>
                    <TableCell>{row.costCenterName}</TableCell>
                    <TableCell>{row.categoryName}</TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        row.type === 'income' ? 'text-primary' : ''
                      }`}
                    >
                      {row.type === 'income' ? '+' : '−'}
                      {formatBrlFromCents(row.amountCents)}
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

export function DashboardPageClient(): React.ReactElement {
  const params = useSearchParamsRecord();
  const query = useQuery({
    queryKey: queryKeys.dashboard(params),
    queryFn: () => api.dashboard.get(params),
  });

  return (
    <QueryBoundary query={query} skeleton={<DashboardPageSkeleton />}>
      {(data) => <DashboardContent data={data} />}
    </QueryBoundary>
  );
}
