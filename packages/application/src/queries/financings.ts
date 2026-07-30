import {
  estimateFinancingResidual,
  type AmortizationSystem,
  type FinancingCategory,
} from '@tim/domain';
import type { FinancingsQuery, FinancingsResponse } from '@tim/api-contract';
import { accounts, categories, costCenters, financings, installments } from '@tim/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { resolveCostCenterId } from '@tim/domain';
import { requireSession } from '@tim/auth';
import type { AppContext } from '../context';

export async function loadFinancings(
  ctx: AppContext,
  params: FinancingsQuery,
): Promise<FinancingsResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;

  const [centers, accs, cats, list, installmentRows] = await Promise.all([
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
    db
      .select()
      .from(categories)
      .where(and(eq(categories.householdId, session.householdId), eq(categories.type, 'expense'))),
    db
      .select()
      .from(financings)
      .where(and(eq(financings.householdId, session.householdId), isNull(financings.deletedAt))),
    db
      .select()
      .from(installments)
      .where(eq(installments.householdId, session.householdId))
      .orderBy(asc(installments.number)),
  ]);

  const centerId = resolveCostCenterId(params.center, new Set(centers.map((center) => center.id)));
  const activeCenterName = centerId
    ? (centers.find((center) => center.id === centerId)?.name ?? null)
    : null;

  const filteredList = centerId
    ? list.filter((financing) => financing.costCenterId === centerId)
    : list;
  const filteredAccounts = centerId
    ? accs.filter((account) => account.costCenterId === centerId)
    : accs;

  let totalRemaining = 0;
  let totalPaid = 0;
  let totalAmortizeCents = 0;
  let totalPendingInstallments = 0;

  const contracts: FinancingsResponse['contracts'] = filteredList.map((financing) => {
    const parcel = installmentRows.filter((item) => item.financingId === financing.id);
    const pending = parcel.filter((item) => item.status === 'pending');
    const paidCents = parcel
      .filter((item) => item.status === 'paid')
      .reduce((acc, item) => acc + item.amountCents, 0);
    const remainingCents = pending.reduce((acc, item) => acc + item.amountCents, 0);
    const amortizeCents = pending.reduce((acc, item) => {
      const principal =
        item.principalCents > 0
          ? item.principalCents
          : Math.max(0, item.amountCents - item.interestCents);
      return acc + principal;
    }, 0);
    const residual = estimateFinancingResidual({
      installments: parcel.map((item) => ({
        status: item.status,
        principalCents: item.principalCents,
        amountCents: item.amountCents,
        interestCents: item.interestCents,
        balanceAfterCents: item.balanceAfterCents,
      })),
    });
    totalRemaining += remainingCents;
    totalPaid += paidCents;
    totalAmortizeCents += amortizeCents;
    totalPendingInstallments += pending.length;
    const next = pending[0] ?? null;
    const progress =
      financing.installmentCount === 0
        ? 0
        : ((financing.installmentCount - pending.length) / financing.installmentCount) * 100;
    const system = financing.amortizationSystem as AmortizationSystem;
    const rateLabel =
      financing.annualRateBps != null
        ? `${(financing.annualRateBps / 100).toFixed(2)}% a.a.`
        : 'sem taxa';

    return {
      id: financing.id,
      name: financing.name,
      institution: financing.institution,
      category: (financing.category ?? 'other') as FinancingCategory,
      system,
      rateLabel,
      installmentCount: financing.installmentCount,
      principalCents: financing.principalCents,
      installmentAmountCents: financing.installmentAmountCents,
      annualRateBps: financing.annualRateBps,
      firstDueOn: financing.firstDueOn,
      pendingCount: pending.length,
      remainingCents,
      amortizeCents,
      paidCents,
      progress,
      residualBalanceCents: residual.balanceCents,
      amortizationPerPeriodCents: residual.amortizationPerPeriodCents,
      nextPending: next
        ? {
            id: next.id,
            number: next.number,
            dueOn: next.dueOn,
            status: next.status,
            amountCents: next.amountCents,
            interestCents: next.interestCents,
            principalCents: next.principalCents,
            paidOn: next.paidOn,
          }
        : null,
      installments: parcel.map((item) => ({
        id: item.id,
        number: item.number,
        dueOn: item.dueOn,
        status: item.status,
        amountCents: item.amountCents,
        interestCents: item.interestCents,
        principalCents: item.principalCents,
        paidOn: item.paidOn,
      })),
    };
  });

  return {
    filters: {
      centerId,
      activeCenterName,
    },
    summary: {
      contractCount: filteredList.length,
      totalRemainingCents: totalRemaining,
      totalAmortizeCents,
      totalPaidCents: totalPaid,
      totalPendingInstallments,
    },
    contracts,
    lookups: {
      centers: centers.map((center) => ({ id: center.id, name: center.name })),
      categories: cats.map((category) => ({ id: category.id, name: category.name })),
      potAccounts: accs
        .filter((account) => account.kind === 'investment_pot')
        .map((account) => ({ id: account.id, name: account.name })),
      planCenters: centers.map((center) => ({ id: center.id, name: center.name })),
      accounts: (filteredAccounts.length > 0 ? filteredAccounts : accs).map((account) => ({
        id: account.id,
        name: account.name,
      })),
      defaultCostCenterId: centerId ?? undefined,
    },
    isEmpty: filteredList.length === 0,
  };
}
