import type { DashboardQuery, DashboardResponse } from '@tim/api-contract';
import {
  analyzeCategoryAttention,
  availableCreditCents,
  cardHasCredit,
  computeMonthlySavingsNeeded,
  computePlanProgress,
  daysBetweenInclusive,
  dueOnForMonth,
  estimateMonthlyYieldCents,
  formatBrlFromCents,
  formatYieldLabel,
  monthBounds,
  PLAN_KIND_LABEL,
  previousRangeOfSameLength,
  resolveCashRadarWindow,
  resolveCostCenterId,
  resolveDateRange,
  shiftMonth,
  sumPlanItems,
  yearMonthFromIso,
  type PlanKind,
  type YieldType,
} from '@tim/domain';
import {
  accounts,
  categories,
  costCenters,
  creditCardInvoices,
  creditCards,
  financings,
  installments,
  planItems,
  plans,
  transactions,
} from '@tim/db';
import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { requireSession } from '@tim/auth';
import type { AppContext } from '../context';

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

function kpiTone(
  current: number,
  previous: number,
  invert: boolean,
): DashboardResponse['kpis']['income']['tone'] {
  if (invert) {
    return current <= previous ? 'positive' : 'negative';
  }
  return current >= previous ? 'positive' : 'negative';
}

function obligationStatus(
  dueOn: string,
  today: string,
  weekEnd: string,
): Pick<DashboardResponse['cashRadar']['obligations'][number], 'statusVariant' | 'statusLabel'> {
  if (dueOn < today) {
    return { statusVariant: 'destructive', statusLabel: 'atraso' };
  }
  if (dueOn <= weekEnd) {
    return { statusVariant: 'secondary', statusLabel: 'esta semana' };
  }
  return { statusVariant: 'outline', statusLabel: 'no período' };
}

export async function loadDashboard(
  ctx: AppContext,
  params: DashboardQuery,
): Promise<DashboardResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
  const now = new Date();
  const today = todayIso();
  const weekEnd = addDaysIso(today, 7);
  const range = resolveDateRange(params, now);
  const prev = previousRangeOfSameLength(range);
  const { start, end } = range;
  const radarWindow = resolveCashRadarWindow({
    today,
    rangeStart: start,
    rangeEnd: end,
  });
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

  const [
    periodTx,
    prevPeriodTx,
    cats,
    fins,
    allPendingRaw,
    recentTx,
    accountRows,
    cardRows,
    pendingPayablesRaw,
    planRows,
    planItemRows,
  ] = await Promise.all([
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
        txFilters(gte(transactions.occurredOn, prev.start), lte(transactions.occurredOn, prev.end)),
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
        and(eq(installments.householdId, session.householdId), eq(installments.status, 'pending')),
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
      .where(and(eq(accounts.householdId, session.householdId), eq(accounts.isArchived, false))),
    db
      .select()
      .from(creditCards)
      .where(
        and(eq(creditCards.householdId, session.householdId), eq(creditCards.isArchived, false)),
      ),
    radarWindow.active
      ? db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.householdId, session.householdId),
              isNull(transactions.deletedAt),
              eq(transactions.type, 'expense'),
              eq(transactions.status, 'pending'),
              isNull(transactions.creditCardId),
              isNotNull(transactions.dueOn),
              or(
                lt(transactions.dueOn, today),
                and(
                  gte(transactions.dueOn, radarWindow.horizonStart),
                  lte(transactions.dueOn, radarWindow.horizonEnd),
                ),
              ),
              centerId ? eq(transactions.costCenterId, centerId) : undefined,
            ),
          )
          .orderBy(asc(transactions.dueOn))
      : Promise.resolve([] as Array<typeof transactions.$inferSelect>),
    db
      .select()
      .from(plans)
      .where(and(eq(plans.householdId, session.householdId), isNull(plans.deletedAt)))
      .orderBy(asc(plans.targetDate)),
    db.select().from(planItems).where(eq(planItems.householdId, session.householdId)),
  ]);

  const accountById = new Map(accountRows.map((row) => [row.id, row]));
  const scopedAccounts = centerId
    ? accountRows.filter((row) => row.costCenterId === centerId)
    : accountRows;
  const cards = cardRows.filter((card) => {
    if (!cardHasCredit(card.cardMode)) return false;
    if (!centerId) return true;
    const paymentAccount = accountById.get(card.paymentAccountId);
    // Conta de pagamento fora do escopo (outro centro) → cartão fora do radar.
    if (!paymentAccount) return false;
    return paymentAccount.costCenterId === centerId;
  });
  const cardById = new Map(cards.map((card) => [card.id, card]));

  const invoiceRows =
    cards.length === 0
      ? []
      : await db
          .select()
          .from(creditCardInvoices)
          .where(
            and(
              eq(creditCardInvoices.householdId, session.householdId),
              inArray(
                creditCardInvoices.creditCardId,
                cards.map((card) => card.id),
              ),
              inArray(creditCardInvoices.status, ['open', 'closed']),
            ),
          )
          .orderBy(asc(creditCardInvoices.dueOn));

  const invoiceIds = invoiceRows.map((invoice) => invoice.id);
  const purchaseByInvoice = new Map<string, number>();
  if (invoiceIds.length > 0) {
    const purchaseAggs = await db
      .select({
        invoiceId: transactions.creditCardInvoiceId,
        total: sql<number>`coalesce(sum(${transactions.amountCents}), 0)::int`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, session.householdId),
          isNull(transactions.deletedAt),
          eq(transactions.type, 'expense'),
          eq(transactions.status, 'paid'),
          inArray(transactions.creditCardInvoiceId, invoiceIds),
        ),
      )
      .groupBy(transactions.creditCardInvoiceId);
    for (const row of purchaseAggs) {
      if (row.invoiceId) purchaseByInvoice.set(row.invoiceId, Number(row.total ?? 0));
    }
  }

  const finIds = new Set(fins.map((financing) => financing.id));
  const allPending = centerId
    ? allPendingRaw.filter((item) => finIds.has(item.financingId))
    : allPendingRaw;

  const incomeCents = periodTx
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + (t.amountCents ?? 0), 0);
  const expenseCents = periodTx
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + (t.amountCents ?? 0), 0);
  const balanceCents = incomeCents - expenseCents;
  const savingsRate = incomeCents === 0 ? null : (balanceCents / incomeCents) * 100;
  const avgDailySpendCents = Math.round(expenseCents / elapsedDays);
  const projectedExpenseCents = Math.round(avgDailySpendCents * rangeDays);

  const prevIncomeCents = Number(prevPeriodTx.find((r) => r.type === 'income')?.total ?? 0);
  const prevExpenseCents = Number(prevPeriodTx.find((r) => r.type === 'expense')?.total ?? 0);
  const prevBalanceCents = prevIncomeCents - prevExpenseCents;

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
  const upcomingTotalCents = upcoming.reduce((acc, item) => acc + item.amountCents, 0);
  const overdueTotalCents = overdue.reduce((acc, item) => acc + item.amountCents, 0);

  const debtRemainingCents = allPending.reduce((acc, item) => acc + item.amountCents, 0);

  const wealthTotalCents = scopedAccounts.reduce((sum, row) => sum + row.balanceCents, 0);
  const wealthInvestedCents = scopedAccounts
    .filter((row) => row.kind === 'investment_pot')
    .reduce((sum, row) => sum + row.balanceCents, 0);
  const wealthLiquidCents = wealthTotalCents - wealthInvestedCents;
  const wealthMonthlyYieldCents = scopedAccounts.reduce(
    (sum, row) =>
      sum +
      estimateMonthlyYieldCents({
        balanceCents: row.balanceCents,
        yieldType: row.yieldType as YieldType,
        yieldBps: row.yieldBps,
      }),
    0,
  );
  const yieldingAccounts = scopedAccounts
    .filter((row) => row.yieldType !== 'none' && row.balanceCents > 0)
    .map((row) => {
      const yieldType = row.yieldType as YieldType;
      return {
        id: row.id,
        name: row.name,
        balanceCents: row.balanceCents,
        yieldType: row.yieldType as DashboardResponse['yieldingAccounts'][number]['yieldType'],
        yieldBps: row.yieldBps,
        monthlyYieldCents: estimateMonthlyYieldCents({
          balanceCents: row.balanceCents,
          yieldType,
          yieldBps: row.yieldBps,
        }),
        yieldLabel: formatYieldLabel(yieldType, row.yieldBps),
      };
    })
    .sort((a, b) => b.monthlyYieldCents - a.monthlyYieldCents)
    .slice(0, 5);

  const radarObligations: DashboardResponse['cashRadar']['obligations'] = [];
  let invoicesDueCents = 0;
  let payablesDueCents = 0;
  let financingDueCents = 0;
  let cashRadarCards: DashboardResponse['cashRadar']['cards'] = [];

  const dueInRadar = (dueOn: string): boolean => {
    if (!radarWindow.active) return false;
    if (dueOn < today) return true;
    return dueOn >= radarWindow.horizonStart && dueOn <= radarWindow.horizonEnd;
  };

  if (radarWindow.active) {
    const invoicesEmittedForCard = new Set<string>();
    for (const invoice of invoiceRows) {
      const card = cardById.get(invoice.creditCardId);
      if (!card) continue;
      const purchases = purchaseByInvoice.get(invoice.id) ?? 0;
      const balance = Math.max(0, purchases - invoice.amountPaidCents);
      if (balance <= 0) continue;
      if (!dueInRadar(invoice.dueOn)) continue;

      invoicesEmittedForCard.add(card.id);
      invoicesDueCents += balance;
      const cardLabel = card.lastFour ? `${card.name} ·••• ${card.lastFour}` : card.name;
      radarObligations.push({
        id: invoice.id,
        kind: 'credit_card_invoice',
        label: `Fatura · ${cardLabel}`,
        dueOn: invoice.dueOn,
        amountCents: balance,
        ...obligationStatus(invoice.dueOn, today, weekEnd),
      });
    }

    for (const card of cards) {
      if (invoicesEmittedForCard.has(card.id)) continue;
      if (card.invoiceBalanceCents <= 0) continue;
      const dueOn = dueOnForMonth(yearMonthFromIso(radarWindow.horizonStart), card.dueDay);
      if (!dueInRadar(dueOn)) continue;

      invoicesDueCents += card.invoiceBalanceCents;
      const cardLabel = card.lastFour ? `${card.name} ·••• ${card.lastFour}` : card.name;
      radarObligations.push({
        id: `card-balance:${card.id}`,
        kind: 'credit_card_invoice',
        label: `Fatura · ${cardLabel}`,
        dueOn,
        amountCents: card.invoiceBalanceCents,
        ...obligationStatus(dueOn, today, weekEnd),
      });
    }

    for (const row of pendingPayablesRaw) {
      const dueOn = row.dueOn;
      if (!dueOn) continue;
      const amountCents = row.amountCents ?? 0;
      if (amountCents <= 0) continue;
      payablesDueCents += amountCents;
      radarObligations.push({
        id: row.id,
        kind: 'payable',
        label: row.description?.trim() || 'Conta a pagar',
        dueOn,
        amountCents,
        ...obligationStatus(dueOn, today, weekEnd),
      });
    }

    for (const item of allPending) {
      if (!dueInRadar(item.dueOn)) continue;
      financingDueCents += item.amountCents;
      radarObligations.push({
        id: item.id,
        kind: 'financing',
        label: `${finMap.get(item.financingId)?.name ?? 'Financiamento'} #${item.number}`,
        dueOn: item.dueOn,
        amountCents: item.amountCents,
        ...obligationStatus(item.dueOn, today, weekEnd),
      });
    }

    radarObligations.sort((a, b) => {
      if (a.dueOn !== b.dueOn) return a.dueOn.localeCompare(b.dueOn);
      return b.amountCents - a.amountCents;
    });

    const nextInvoiceByCard = new Map<
      string,
      { closesOn: string; dueOn: string; status: 'open' | 'closed' | 'paid'; balance: number }
    >();
    for (const invoice of invoiceRows) {
      const purchases = purchaseByInvoice.get(invoice.id) ?? 0;
      const balance = Math.max(0, purchases - invoice.amountPaidCents);
      const existing = nextInvoiceByCard.get(invoice.creditCardId);
      if (!existing || invoice.dueOn < existing.dueOn) {
        nextInvoiceByCard.set(invoice.creditCardId, {
          closesOn: invoice.closesOn,
          dueOn: invoice.dueOn,
          status: invoice.status,
          balance,
        });
      }
    }

    cashRadarCards = cards
      .map((card) => {
        const next = nextInvoiceByCard.get(card.id);
        const invoiceBalanceCents =
          next && next.balance > 0 ? next.balance : Math.max(0, card.invoiceBalanceCents);
        const status: DashboardResponse['cashRadar']['cards'][number]['status'] =
          next?.status ?? (invoiceBalanceCents > 0 ? 'open' : 'none');
        return {
          id: card.id,
          name: card.name,
          lastFour: card.lastFour,
          invoiceBalanceCents,
          availableCents: availableCreditCents({
            creditLimitCents: card.creditLimitCents,
            invoiceBalanceCents: card.invoiceBalanceCents,
          }),
          closesOn: next?.closesOn ?? null,
          dueOn:
            next?.dueOn ??
            (invoiceBalanceCents > 0
              ? dueOnForMonth(yearMonthFromIso(radarWindow.horizonStart), card.dueDay)
              : null),
          status,
        };
      })
      .sort((a, b) => b.invoiceBalanceCents - a.invoiceBalanceCents);
  }

  const obligationsTotalCents = invoicesDueCents + payablesDueCents + financingDueCents;
  const overdueCents = radarObligations
    .filter((item) => item.dueOn < today)
    .reduce((sum, item) => sum + item.amountCents, 0);

  const radarLiquidCents = scopedAccounts
    .filter((row) => row.kind !== 'investment_pot')
    .reduce((sum, row) => sum + row.balanceCents, 0);

  const cashRadar: DashboardResponse['cashRadar'] = {
    active: radarWindow.active,
    horizonDays: radarWindow.horizonDays,
    horizonStart: radarWindow.horizonStart,
    horizonEnd: radarWindow.horizonEnd,
    horizonLabel: radarWindow.horizonLabel,
    liquidCents: radarLiquidCents,
    obligationsTotalCents,
    gapCents: radarWindow.active ? radarLiquidCents - obligationsTotalCents : 0,
    overdueCents,
    invoicesDueCents,
    payablesDueCents,
    financingDueCents,
    obligations: radarObligations.slice(0, 10),
    cards: cashRadarCards,
  };

  const creditExpenseCents = periodTx
    .filter((t) => t.type === 'expense' && t.creditCardId != null)
    .reduce((acc, t) => acc + (t.amountCents ?? 0), 0);
  const accountExpenseCents = Math.max(0, expenseCents - creditExpenseCents);
  const paymentMixBuckets: DashboardResponse['paymentMix']['buckets'] = [];
  if (expenseCents > 0) {
    if (accountExpenseCents > 0) {
      paymentMixBuckets.push({
        key: 'account',
        label: 'Conta (PIX / débito / TED)',
        amountCents: accountExpenseCents,
        sharePct: Math.round((accountExpenseCents / expenseCents) * 100),
      });
    }
    if (creditExpenseCents > 0) {
      paymentMixBuckets.push({
        key: 'credit_card',
        label: 'Cartão de crédito',
        amountCents: creditExpenseCents,
        sharePct: Math.round((creditExpenseCents / expenseCents) * 100),
      });
    }
  }
  const paymentMix: DashboardResponse['paymentMix'] = {
    totalExpenseCents: expenseCents,
    buckets: paymentMixBuckets,
  };

  const itemsByPlan = new Map<string, typeof planItemRows>();
  for (const item of planItemRows) {
    const list = itemsByPlan.get(item.planId) ?? [];
    list.push(item);
    itemsByPlan.set(item.planId, list);
  }

  const scopedPlanRows = planRows;

  let totalPlannedCents = 0;
  let totalSavedCents = 0;
  let monthlyNeededTotalCents = 0;
  const planningPlans: DashboardResponse['planning']['plans'] = [];

  for (const plan of scopedPlanRows) {
    const kind = plan.kind as PlanKind;
    const targetCents = sumPlanItems(itemsByPlan.get(plan.id) ?? []);
    const linked = plan.linkedAccountId ? accountById.get(plan.linkedAccountId) : undefined;
    const savedCents = linked?.balanceCents ?? 0;
    const progress = computePlanProgress(savedCents, targetCents);
    const monthlyNeededCents = progress.isComplete
      ? 0
      : computeMonthlySavingsNeeded({
          targetCents,
          savedCents,
          targetDate: plan.targetDate,
          fromDate: today,
        });

    totalPlannedCents += targetCents;
    totalSavedCents += savedCents;
    if (!progress.isComplete) {
      monthlyNeededTotalCents += monthlyNeededCents;
    }

    planningPlans.push({
      id: plan.id,
      name: plan.name,
      kind,
      kindLabel: PLAN_KIND_LABEL[kind],
      targetDate: plan.targetDate,
      savedCents: progress.savedCents,
      targetCents: progress.targetCents,
      remainingCents: progress.remainingCents,
      progressPct: progress.progressPercent,
      monthlyNeededCents: progress.isComplete ? null : monthlyNeededCents,
      linkedAccountName: linked?.name ?? null,
      isComplete: progress.isComplete,
      isOverdue: !progress.isComplete && plan.targetDate < today,
    });
  }

  planningPlans.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return a.targetDate.localeCompare(b.targetDate);
  });

  const nextOpen = planningPlans.find((plan) => !plan.isComplete) ?? null;
  const planning: DashboardResponse['planning'] = {
    totalPlannedCents,
    totalSavedCents,
    totalRemainingCents: Math.max(0, totalPlannedCents - totalSavedCents),
    monthlyNeededTotalCents,
    nextPlan: nextOpen
      ? {
          id: nextOpen.id,
          name: nextOpen.name,
          targetDate: nextOpen.targetDate,
          kind: nextOpen.kind,
        }
      : null,
    plans: planningPlans.slice(0, 5),
  };

  const financingCards = fins.map((financing) => {
    const parcels = allPending.filter((i) => i.financingId === financing.id);
    const remainingCents = parcels.reduce((acc, i) => acc + i.amountCents, 0);
    const next = parcels[0];
    const paidCount = financing.installmentCount - parcels.length;
    const progressPct =
      financing.installmentCount === 0 ? 0 : (paidCount / financing.installmentCount) * 100;
    return {
      id: financing.id,
      name: financing.name,
      institution: financing.institution,
      amortizationSystem: financing.amortizationSystem,
      paidCount,
      installmentCount: financing.installmentCount,
      remainingCents,
      progressPct,
      nextDueOn: next?.dueOn ?? null,
      nextAmountCents: next?.amountCents ?? null,
    };
  });

  const trendMonthsCount =
    range.period === 'last_3m'
      ? 3
      : range.period === 'ytd'
        ? Math.min(12, now.getUTCMonth() + 1)
        : 6;
  const rangeEndMonth = new Date(`${end}T00:00:00.000Z`);
  const trendMonths = Array.from({ length: trendMonthsCount }, (_, index) =>
    monthBounds(shiftMonth(rangeEndMonth, index - (trendMonthsCount - 1)), 'short'),
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
    const monthIncomeCents = inMonth
      .filter((t) => t.type === 'income')
      .reduce((acc, t) => acc + (t.amountCents ?? 0), 0);
    const monthExpenseCents = inMonth
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + (t.amountCents ?? 0), 0);
    return {
      label: month.label,
      incomeCents: monthIncomeCents,
      expenseCents: monthExpenseCents,
      balanceCents: monthIncomeCents - monthExpenseCents,
    };
  });

  const attentionMonths = Array.from({ length: 6 }, (_, index) => {
    const bounds = monthBounds(shiftMonth(new Date(`${end}T00:00:00.000Z`), index - 5), 'short');
    return {
      key: bounds.start.slice(0, 7),
      label: bounds.label,
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
  const expenseShare =
    incomeCents === 0 ? null : Math.min(100, Math.round((expenseCents / incomeCents) * 100));

  const insights: DashboardResponse['insights'] = [];

  if (cashRadar.active && cashRadar.overdueCents > 0) {
    insights.push({
      title: 'Obrigações em atraso',
      detail: `${formatBrlFromCents(cashRadar.overdueCents)} vencidos — priorize quitação`,
      tone: 'bad',
    });
  } else if (cashRadar.active && cashRadar.gapCents < 0) {
    insights.push({
      title: 'Caixa apertado no período',
      detail: `Faltam ${formatBrlFromCents(Math.abs(cashRadar.gapCents))} além do líquido disponível`,
      tone: 'bad',
    });
  } else if (cashRadar.active && cashRadar.obligationsTotalCents > 0) {
    insights.push({
      title: 'Caixa cobre o período',
      detail: `${formatBrlFromCents(cashRadar.gapCents)} de folga após ${formatBrlFromCents(cashRadar.obligationsTotalCents)} a vencer`,
      tone: 'good',
    });
  }

  if (overdue.length > 0 && cashRadar.overdueCents === 0) {
    insights.push({
      title: `${overdue.length} parcela${overdue.length > 1 ? 's' : ''} em atraso`,
      detail: `${formatBrlFromCents(overdueTotalCents)} vencidos antes de hoje`,
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
  if (creditExpenseCents > 0 && expenseCents > 0) {
    const creditShare = Math.round((creditExpenseCents / expenseCents) * 100);
    insights.push({
      title: `${creditShare}% das despesas no crédito`,
      detail: `${formatBrlFromCents(creditExpenseCents)} na fatura · ${formatBrlFromCents(accountExpenseCents)} saíram da conta`,
      tone: creditShare >= 50 ? 'warn' : 'neutral',
    });
  }
  if (planning.plans.some((plan) => plan.isOverdue)) {
    const overduePlans = planning.plans.filter((plan) => plan.isOverdue);
    insights.push({
      title: `${overduePlans.length} meta${overduePlans.length > 1 ? 's' : ''} atrasada${overduePlans.length > 1 ? 's' : ''}`,
      detail: overduePlans.map((plan) => plan.name).join(', '),
      tone: 'bad',
    });
  } else if (planning.monthlyNeededTotalCents > 0) {
    insights.push({
      title: 'Ritmo das metas',
      detail: `~${formatBrlFromCents(planning.monthlyNeededTotalCents)}/mês para fechar no prazo`,
      tone: 'neutral',
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
          : `Déficit de ${formatBrlFromCents(Math.abs(balanceCents))}`,
      tone: savingsRate >= 20 ? 'good' : savingsRate >= 0 ? 'warn' : 'bad',
    });
  }
  if (wealthMonthlyYieldCents > 0) {
    insights.push({
      title: 'Rendimento estimado',
      detail: `~${formatBrlFromCents(wealthMonthlyYieldCents)}/mês em caixinhas e investimentos`,
      tone: 'good',
    });
  }
  if (wealthInvestedCents > 0 && wealthTotalCents > 0) {
    const investShare = Math.round((wealthInvestedCents / wealthTotalCents) * 100);
    insights.push({
      title: `${investShare}% do patrimônio investido`,
      detail: `${formatBrlFromCents(wealthInvestedCents)} em caixinhas · ${formatBrlFromCents(wealthLiquidCents)} líquido`,
      tone: 'neutral',
    });
  }
  if (topCategory) {
    const share = expenseCents === 0 ? 0 : (topCategory.amountCents / expenseCents) * 100;
    insights.push({
      title: `Maior gasto: ${topCategory.name}`,
      detail: `${formatBrlFromCents(topCategory.amountCents)} · ${share.toFixed(0)}% das despesas`,
      tone: share >= 40 ? 'warn' : 'neutral',
    });
  }
  if (projectedExpenseCents > 0 && incomeCents > 0 && range.period === 'this_month') {
    insights.push({
      title: 'Projeção de despesa no mês',
      detail: `${formatBrlFromCents(projectedExpenseCents)} no ritmo atual (${formatBrlFromCents(avgDailySpendCents)}/dia)`,
      tone: projectedExpenseCents > incomeCents ? 'bad' : 'neutral',
    });
  }
  if (insights.length === 0) {
    insights.push({
      title: 'Sem sinais críticos',
      detail: 'Continue registrando movimentos no extrato para enriquecer os insights.',
      tone: 'neutral',
    });
  }

  const dueInstallments = [...overdue, ...upcoming]
    .filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 8)
    .map((item) => {
      const isOverdue = item.dueOn < today;
      const isSoon = !isOverdue && item.dueOn <= weekEnd;
      return {
        id: item.id,
        financingId: item.financingId,
        financingName: finMap.get(item.financingId)?.name ?? 'Financiamento',
        number: item.number,
        dueOn: item.dueOn,
        amountCents: item.amountCents,
        statusVariant: (isOverdue ? 'destructive' : isSoon ? 'secondary' : 'outline') as
          'destructive' | 'secondary' | 'outline',
        statusLabel: isOverdue ? 'atraso' : isSoon ? 'esta semana' : 'agendada',
      };
    });

  const scopeLabel = [range.label, activeCenterName].filter(Boolean).join(' · ');

  return {
    today,
    weekEnd,
    range: {
      start: range.start,
      end: range.end,
      period: range.period,
      label: range.label,
    },
    scopeLabel,
    scopeQuery: {
      center: centerId,
      period: range.period,
      from: params.from,
      to: params.to,
    },
    meta: {
      movementCount: periodTx.length,
      financingCount: fins.length,
      elapsedDays,
      rangeDays,
    },
    kpis: {
      income: {
        cents: incomeCents,
        prevCents: prevIncomeCents,
        deltaLabel: deltaLabel(incomeCents, prevIncomeCents),
        tone: kpiTone(incomeCents, prevIncomeCents, false),
      },
      expense: {
        cents: expenseCents,
        prevCents: prevExpenseCents,
        deltaLabel: deltaLabel(expenseCents, prevExpenseCents),
        tone: kpiTone(expenseCents, prevExpenseCents, true),
      },
      balance: {
        cents: balanceCents,
        prevCents: prevBalanceCents,
        deltaLabel: deltaLabel(balanceCents, prevBalanceCents),
        tone: balanceCents < 0 ? 'negative' : 'positive',
      },
      savingsRate: {
        value: savingsRate,
        expenseShare,
        hint:
          expenseShare === null
            ? 'Sem receita no período'
            : `${expenseShare}% da receita comprometida`,
        tone:
          savingsRate === null
            ? 'default'
            : savingsRate >= 20
              ? 'positive'
              : savingsRate < 0
                ? 'negative'
                : 'default',
      },
      avgDailySpend: {
        cents: avgDailySpendCents,
        projectedExpenseCents,
        hint:
          range.period === 'this_month'
            ? `Projeção mês: ${formatBrlFromCents(projectedExpenseCents)}`
            : `${elapsedDays} dias na base`,
      },
      debtRemaining: {
        cents: debtRemainingCents,
        pendingCount: allPending.length,
      },
      wealth: {
        totalCents: wealthTotalCents,
        investedCents: wealthInvestedCents,
        liquidCents: wealthLiquidCents,
        monthlyYieldCents: wealthMonthlyYieldCents,
        accountCount: scopedAccounts.length,
      },
    },
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
    recentTransactions: recentTx.map((row) => ({
      id: row.id,
      occurredOn: row.occurredOn,
      description: row.description || catMap.get(row.categoryId) || 'Lançamento',
      costCenterName: centerMap.get(row.costCenterId) ?? '—',
      categoryName: catMap.get(row.categoryId) ?? '—',
      type: row.type,
      amountCents: row.amountCents ?? 0,
    })),
    lookups: {
      centers: centers.map((center) => ({ id: center.id, name: center.name })),
      activeCenterId: centerId,
      customFrom: params.from,
      customTo: params.to,
    },
  };
}
