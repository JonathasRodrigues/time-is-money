'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlanningResponse } from '@tim/api-contract';
import { formatBrlFromCents, formatIsoDateBr, PLAN_KIND_LABEL } from '@tim/domain';
import Link from 'next/link';
import { NewPlanSheet } from '@/components/new-plan-sheet';
import { PageHeader } from '@/components/page-header';
import { PlanCard } from '@/components/plan-card';
import { QueryBoundary } from '@/components/query-boundary';
import { CardsPageSkeleton } from '@/components/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { useSearchParamsRecord } from '@/hooks/use-search-params-record';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';
import { cn } from '@/lib/utils';

const KIND_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'travel', label: 'Viagens' },
  { value: 'financing_payoff', label: 'Quitação' },
  { value: 'real_estate_amortization', label: 'Amortização' },
  { value: 'custom', label: 'Outros' },
];

function PlanningContent({ data }: { data: PlanningResponse }): React.ReactElement {
  const { filters, summary, plans, lookups, canWrite } = data;
  const kindFilter = filters.kind;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Planejamento"
        description="Metas, quitação, amortização imobiliária e progresso via caixinha."
        actions={
          canWrite ? (
            <NewPlanSheet
              centers={lookups.centers}
              potAccounts={lookups.potAccounts}
              financings={lookups.financings}
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

      {summary.totalPlannedCents > 0 || plans.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Total planejado</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {formatBrlFromCents(summary.totalPlannedCents)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Guardado</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">
              {formatBrlFromCents(summary.totalSavedCents)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Falta guardar</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
              {formatBrlFromCents(summary.totalRemainingCents)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-xs text-muted-foreground">Próximo plano</p>
            <p className="mt-1.5 text-sm font-semibold">
              {summary.nextPlan ? summary.nextPlan.name : '—'}
            </p>
            {summary.nextPlan ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatIsoDateBr(summary.nextPlan.targetDate)} ·{' '}
                {PLAN_KIND_LABEL[summary.nextPlan.kind]}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center">
          <p className="text-base font-medium">Nenhum plano ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma viagem, meta personalizada ou plano de quitação de financiamento.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanningPageClient(): React.ReactElement {
  const params = useSearchParamsRecord();
  const query = useQuery({
    queryKey: queryKeys.planning(params),
    queryFn: () => api.planning.list(params),
  });

  return (
    <QueryBoundary query={query} skeleton={<CardsPageSkeleton />}>
      {(data) => <PlanningContent data={data} />}
    </QueryBoundary>
  );
}
