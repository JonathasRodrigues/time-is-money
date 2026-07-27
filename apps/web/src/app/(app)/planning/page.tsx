export const dynamic = 'force-dynamic';

import {
  formatBrlFromCents,
  formatIsoDateBr,
  PLAN_KIND_LABEL,
  sumPlanItems,
  type AmortizationSystem,
  type PlanKind,
} from '@tim/domain';
import {
  accounts,
  costCenters,
  financings,
  installments,
  planContributions,
  planItems,
  plans,
} from '@tim/db';
import { hasCapability } from '@tim/permissions';
import { and, asc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewPlanSheet } from '@/components/new-plan-sheet';
import { PageHeader } from '@/components/page-header';
import { PlanCard, type PlanCardData } from '@/components/plan-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getAuthSession, getDb } from '@/server/db';

const KIND_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'travel', label: 'Viagens' },
  { value: 'financing_payoff', label: 'Quitação' },
  { value: 'custom', label: 'Outros' },
];

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');
  const db = getDb();
  const params = await searchParams;
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
      const pending = installmentRows.filter(
        (item) => item.financingId === financing.id && item.status === 'pending',
      );
      const balanceCents = pending.reduce((sum, item) => sum + item.amountCents, 0);
      const amortizationCents = pending.reduce((sum, item) => {
        const principal =
          item.principalCents > 0
            ? item.principalCents
            : Math.max(0, item.amountCents - item.interestCents);
        return sum + principal;
      }, 0);
      return {
        id: financing.id,
        name: financing.name,
        balanceCents,
        system: financing.amortizationSystem as AmortizationSystem,
        annualRateBps: financing.annualRateBps,
        installmentAmountCents: financing.installmentAmountCents,
        amortizationCents,
        firstDueOn: pending[0]?.dueOn ?? financing.firstDueOn,
      };
    })
    .filter((financing) => financing.balanceCents > 0);

  const filteredPlans =
    kindFilter === 'all' ? planRows : planRows.filter((plan) => plan.kind === kindFilter);

  const cards: PlanCardData[] = filteredPlans.map((plan) => {
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
        plan.kind === 'financing_payoff' && financingOption
          ? {
              balanceCents: financingOption.balanceCents,
              system: financingOption.system,
              annualRateBps: financingOption.annualRateBps,
              installmentAmountCents: financingOption.installmentAmountCents,
              amortizationCents: financingOption.amortizationCents,
              firstDueOn: financingOption.firstDueOn,
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Planejamento"
        description="Metas com itens detalhados, quitação de financiamentos e progresso via caixinha."
        actions={
          canWrite ? (
            <NewPlanSheet
              centers={centers.map((center) => ({ id: center.id, name: center.name }))}
              potAccounts={potAccounts}
              financings={financingOptions}
            />
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === 'all' ? '/planning' : `/planning?kind=${filter.value}`}
          >
            <Badge
              variant={kindFilter === filter.value ? 'default' : 'secondary'}
              className={cn('cursor-pointer px-3 py-1')}
            >
              {filter.label}
            </Badge>
          </Link>
        ))}
      </div>

      {planRows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Total planejado</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {formatBrlFromCents(totalPlanned)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Guardado</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {formatBrlFromCents(totalSaved)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Falta guardar</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
              {formatBrlFromCents(totalRemaining)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Próximo plano</p>
            <p className="mt-1.5 text-sm font-semibold">{nextPlan ? nextPlan.name : '—'}</p>
            {nextPlan ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatIsoDateBr(nextPlan.targetDate)} ·{' '}
                {PLAN_KIND_LABEL[nextPlan.kind as PlanKind]}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center">
          <p className="text-base font-medium">Nenhum plano ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma viagem, meta personalizada ou plano de quitação de financiamento.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
