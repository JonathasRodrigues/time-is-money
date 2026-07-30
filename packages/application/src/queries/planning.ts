import { hasCapability } from '@tim/permissions';
import {
  estimateFinancingResidual,
  sumPlanItems,
  type AmortizationSystem,
  type FinancingCategory,
  type PlanKind,
} from '@tim/domain';
import type { PlanningQuery, PlanningResponse } from '@tim/api-contract';
import {
  accounts,
  costCenters,
  financings,
  installments,
  planContributions,
  planItems,
  plans,
} from '@tim/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { requireSession } from '@tim/auth';
import type { AppContext } from '../context';

export async function loadPlanning(
  ctx: AppContext,
  params: PlanningQuery,
): Promise<PlanningResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
  const kindFilter = params.kind ?? 'all';
  const canWrite = hasCapability(session.role, 'plans.write');

  const [centers, accs, financingRows, installmentRows, planRows, itemRows, contributionRows] =
    await Promise.all([
      db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
      db
        .select()
        .from(accounts)
        .where(and(eq(accounts.householdId, session.householdId), eq(accounts.isArchived, false))),
      db
        .select()
        .from(financings)
        .where(and(eq(financings.householdId, session.householdId), isNull(financings.deletedAt))),
      db
        .select()
        .from(installments)
        .where(eq(installments.householdId, session.householdId))
        .orderBy(asc(installments.number)),
      db
        .select()
        .from(plans)
        .where(and(eq(plans.householdId, session.householdId), isNull(plans.deletedAt)))
        .orderBy(asc(plans.targetDate)),
      db.select().from(planItems).where(eq(planItems.householdId, session.householdId)),
      db
        .select()
        .from(planContributions)
        .where(eq(planContributions.householdId, session.householdId)),
    ]);

  const potAccounts = accs
    .filter((account) => account.kind === 'investment_pot')
    .map((account) => ({ id: account.id, name: account.name }));

  const accountMap = new Map(accs.map((account) => [account.id, account]));
  const financingMap = new Map(financingRows.map((financing) => [financing.id, financing]));
  const itemsByPlan = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByPlan.get(item.planId) ?? [];
    list.push(item);
    itemsByPlan.set(item.planId, list);
  }
  const contributionsByPlan = new Map<string, typeof contributionRows>();
  for (const row of contributionRows) {
    const list = contributionsByPlan.get(row.planId) ?? [];
    list.push(row);
    contributionsByPlan.set(row.planId, list);
  }

  const financingOptions = financingRows
    .map((financing) => {
      const related = installmentRows.filter((item) => item.financingId === financing.id);
      const pending = related
        .filter((item) => item.status === 'pending')
        .sort((a, b) => a.number - b.number);
      const { balanceCents, amortizationPerPeriodCents } = estimateFinancingResidual({
        installments: related.map((item) => ({
          status: item.status,
          principalCents: item.principalCents,
          amountCents: item.amountCents,
          interestCents: item.interestCents,
          balanceAfterCents: item.balanceAfterCents,
        })),
      });
      return {
        id: financing.id,
        name: financing.name,
        category: financing.category as FinancingCategory,
        balanceCents,
        system: financing.amortizationSystem as AmortizationSystem,
        annualRateBps: financing.annualRateBps,
        installmentAmountCents: financing.installmentAmountCents,
        amortizationCents: amortizationPerPeriodCents,
        firstDueOn: pending[0]?.dueOn ?? financing.firstDueOn,
        pendingInstallments: pending.map((item) => ({
          number: item.number,
          dueOn: item.dueOn,
          principalCents:
            item.principalCents > 0
              ? item.principalCents
              : Math.max(0, item.amountCents - item.interestCents),
          amountCents: item.amountCents,
          interestCents: item.interestCents,
        })),
      };
    })
    .filter((financing) => financing.balanceCents > 0);

  const filteredPlans =
    kindFilter === 'all' ? planRows : planRows.filter((plan) => plan.kind === kindFilter);

  const planCards: PlanningResponse['plans'] = filteredPlans.map((plan) => {
    const planItemList = (itemsByPlan.get(plan.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    const targetCents = sumPlanItems(planItemList);
    const linkedAccount = plan.linkedAccountId ? accountMap.get(plan.linkedAccountId) : undefined;
    const financing = plan.financingId ? financingMap.get(plan.financingId) : undefined;
    const financingOption = financingOptions.find((item) => item.id === plan.financingId);

    return {
      id: plan.id,
      kind: plan.kind as PlanKind,
      name: plan.name,
      targetDate: plan.targetDate,
      savedCents: linkedAccount?.balanceCents ?? 0,
      targetCents,
      monthlyTargetCents: plan.monthlyTargetCents,
      linkedAccountName: linkedAccount?.name ?? null,
      financingName: financing?.name ?? null,
      items: planItemList.map((item) => ({
        label: item.label,
        amountCents: item.amountCents,
      })),
      contributions: (contributionsByPlan.get(plan.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({
          dueOn: row.dueOn,
          amountCents: row.amountCents,
        })),
      financingPayoff:
        (plan.kind === 'financing_payoff' || plan.kind === 'real_estate_amortization') &&
        financingOption
          ? {
              balanceCents: financingOption.balanceCents,
              system: financingOption.system,
              annualRateBps: financingOption.annualRateBps,
              installmentAmountCents: financingOption.installmentAmountCents,
              amortizationCents: financingOption.amortizationCents,
              firstDueOn: financingOption.firstDueOn,
              pendingInstallments: financingOption.pendingInstallments,
            }
          : undefined,
      canWrite,
    };
  });

  let totalPlanned = 0;
  let totalSaved = 0;
  for (const plan of planRows) {
    const planItemsList = itemsByPlan.get(plan.id) ?? [];
    totalPlanned += sumPlanItems(planItemsList);
    if (plan.linkedAccountId) {
      totalSaved += accountMap.get(plan.linkedAccountId)?.balanceCents ?? 0;
    }
  }
  const totalRemaining = Math.max(0, totalPlanned - totalSaved);
  const nextPlan = planRows[0] ?? null;

  return {
    filters: {
      kind: kindFilter,
    },
    summary: {
      totalPlannedCents: totalPlanned,
      totalSavedCents: totalSaved,
      totalRemainingCents: totalRemaining,
      nextPlan: nextPlan
        ? {
            id: nextPlan.id,
            name: nextPlan.name,
            targetDate: nextPlan.targetDate,
            kind: nextPlan.kind as PlanKind,
          }
        : null,
    },
    plans: planCards,
    lookups: {
      centers: centers.map((center) => ({ id: center.id, name: center.name })),
      potAccounts,
      financings: financingOptions,
    },
    canWrite,
    isEmpty: planCards.length === 0,
  };
}
