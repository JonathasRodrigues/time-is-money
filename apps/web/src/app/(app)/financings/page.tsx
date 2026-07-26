export const dynamic = 'force-dynamic';

import { formatBrlFromCents, type AmortizationSystem } from '@tim/domain';
import { accounts, categories, costCenters, financings, installments } from '@tim/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { CostCenterFilter } from '@/components/cost-center-filter';
import { FinancingContractCard } from '@/components/financing-contract-card';
import { NewFinancingSheet } from '@/components/new-financing-sheet';
import { PageHeader } from '@/components/page-header';
import { resolveCostCenterId } from '@/lib/scope-query';
import { getAuthSession, getDb } from '@/server/db';

export default async function FinancingsPage({
  searchParams,
}: {
  searchParams: Promise<{ center?: string }>;
}): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');
  const db = getDb();
  const params = await searchParams;

  const [centers, accs, cats, list] = await Promise.all([
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

  const installmentRows = await db
    .select()
    .from(installments)
    .where(eq(installments.householdId, session.householdId))
    .orderBy(asc(installments.number));

  const todayIso = new Date().toISOString().slice(0, 10);
  const categoryOptions = cats.map((c) => ({ id: c.id, name: c.name }));

  let totalRemaining = 0;
  let totalPaid = 0;
  let totalPendingInstallments = 0;

  const contracts = filteredList.map((financing) => {
    const parcel = installmentRows.filter((i) => i.financingId === financing.id);
    const pending = parcel.filter((i) => i.status === 'pending');
    const paidCents = parcel
      .filter((i) => i.status === 'paid')
      .reduce((acc, i) => acc + i.amountCents, 0);
    const remainingCents = pending.reduce((acc, i) => acc + i.amountCents, 0);
    totalRemaining += remainingCents;
    totalPaid += paidCents;
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
      financing,
      parcel,
      pending,
      paidCents,
      remainingCents,
      progress,
      system,
      rateLabel,
      next,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Financiamentos"
        description={
          activeCenterName
            ? `Contratos de ${activeCenterName}`
            : 'Acompanhe parcelas, pague a próxima e simule novos contratos.'
        }
        actions={
          <NewFinancingSheet
            centers={centers.map((c) => ({ id: c.id, name: c.name }))}
            accounts={(filteredAccounts.length > 0 ? filteredAccounts : accs).map((a) => ({
              id: a.id,
              name: a.name,
            }))}
            defaultCostCenterId={centerId ?? undefined}
          />
        }
      />

      <CostCenterFilter
        centers={centers.map((center) => ({ id: center.id, name: center.name }))}
        activeId={centerId}
        basePath="/financings"
      />

      {filteredList.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Contratos</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{filteredList.length}</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Restante a pagar</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
              {formatBrlFromCents(totalRemaining)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Já pago</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {formatBrlFromCents(totalPaid)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Parcelas pendentes</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{totalPendingInstallments}</p>
          </div>
        </div>
      ) : null}

      {contracts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center">
          <p className="text-base font-medium">Nenhum financiamento ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use <span className="font-medium">Novo</span> para simular Price/SAC e gravar o
            contrato.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {contracts.map(
            ({
              financing,
              parcel,
              pending,
              paidCents,
              remainingCents,
              progress,
              system,
              rateLabel,
              next,
            }) => (
              <FinancingContractCard
                key={financing.id}
                name={financing.name}
                institution={financing.institution}
                system={system}
                rateLabel={rateLabel}
                installmentCount={financing.installmentCount}
                principalCents={financing.principalCents}
                pendingCount={pending.length}
                remainingCents={remainingCents}
                paidCents={paidCents}
                progress={progress}
                nextPending={next}
                categories={categoryOptions}
                todayIso={todayIso}
                installments={parcel.map((item) => ({
                  id: item.id,
                  number: item.number,
                  dueOn: item.dueOn,
                  status: item.status,
                  amountCents: item.amountCents,
                  interestCents: item.interestCents,
                  principalCents: item.principalCents,
                  paidOn: item.paidOn,
                }))}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
