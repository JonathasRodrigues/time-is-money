'use client';

import { useQuery } from '@tanstack/react-query';
import type { FinancingsResponse } from '@tim/api-contract';
import { formatBrlFromCents } from '@tim/domain';
import { CostCenterFilter } from '@/components/cost-center-filter';
import { FinancingContractCard } from '@/components/financing-contract-card';
import { NewFinancingSheet } from '@/components/new-financing-sheet';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { CardsPageSkeleton } from '@/components/page-skeletons';
import { useSearchParamsRecord } from '@/hooks/use-search-params-record';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';

function FinancingsContent({ data }: { data: FinancingsResponse }): React.ReactElement {
  const { filters, summary, contracts, lookups } = data;
  const { centerId, activeCenterName } = filters;

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
            centers={lookups.centers}
            accounts={lookups.accounts}
            defaultCostCenterId={lookups.defaultCostCenterId ?? centerId ?? undefined}
          />
        }
      />

      <CostCenterFilter centers={lookups.centers} activeId={centerId} basePath="/financings" />

      {summary.contractCount > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Contratos</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{summary.contractCount}</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Restante a pagar</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
              {formatBrlFromCents(summary.totalRemainingCents)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">parcelas com juros</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Se amortizar</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {formatBrlFromCents(summary.totalAmortizeCents)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              só principal
              {summary.totalRemainingCents > summary.totalAmortizeCents
                ? ` · evita ${formatBrlFromCents(
                    summary.totalRemainingCents - summary.totalAmortizeCents,
                  )}`
                : null}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Já pago</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {formatBrlFromCents(summary.totalPaidCents)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Parcelas pendentes</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {summary.totalPendingInstallments}
            </p>
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
          {contracts.map((contract) => (
            <FinancingContractCard
              key={contract.id}
              financingId={contract.id}
              name={contract.name}
              institution={contract.institution}
              category={contract.category}
              system={contract.system}
              rateLabel={contract.rateLabel}
              installmentCount={contract.installmentCount}
              principalCents={contract.principalCents}
              installmentAmountCents={contract.installmentAmountCents}
              annualRateBps={contract.annualRateBps}
              firstDueOn={contract.firstDueOn}
              pendingCount={contract.pendingCount}
              remainingCents={contract.remainingCents}
              amortizeCents={contract.amortizeCents}
              paidCents={contract.paidCents}
              progress={contract.progress}
              nextPending={contract.nextPending}
              categories={lookups.categories}
              installments={contract.installments}
              potAccounts={lookups.potAccounts}
              planCenters={lookups.planCenters}
              financingPayoffContext={{
                balanceCents: contract.residualBalanceCents,
                amortizationCents: contract.amortizationPerPeriodCents,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FinancingsPageClient(): React.ReactElement {
  const params = useSearchParamsRecord();
  const query = useQuery({
    queryKey: queryKeys.financings(params),
    queryFn: () => api.financings.list(params),
  });

  return (
    <QueryBoundary query={query} skeleton={<CardsPageSkeleton />}>
      {(data) => <FinancingsContent data={data} />}
    </QueryBoundary>
  );
}
