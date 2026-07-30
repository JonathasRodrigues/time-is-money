'use client';

import { useQuery } from '@tanstack/react-query';
import type { CostCentersResponse } from '@tim/api-contract';
import { Building2 } from 'lucide-react';
import { NewCostCenterSheet } from '@/components/new-cost-center-sheet';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { PageSkeleton } from '@/components/page-skeletons';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';

type CostCenterRow = CostCentersResponse['items'][number];

function CostCenterTile({ row }: { row: CostCenterRow }): React.ReactElement {
  const accent = row.color ?? '#155e4f';

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border bg-gradient-to-br from-muted/40 via-background to-background p-4 shadow-xs"
      style={{ borderColor: `${accent}33` }}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="size-3.5 shrink-0 rounded-full border border-border shadow-xs"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <p className="truncate text-sm font-medium tracking-tight">{row.name}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {row.isSystem ? 'Seed do sistema' : 'Personalizado'}
        </p>
      </div>
      <div
        className="mt-auto h-1.5 w-full rounded-full"
        style={{ backgroundColor: `${accent}40` }}
        aria-hidden
      >
        <div className="h-full w-2/5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
    </div>
  );
}

function CostCentersContent({ data }: { data: CostCentersResponse }): React.ReactElement {
  const { items } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Centros de custo"
        description="Separe PF, empresas e outros contextos com uma cor para identificar no app."
        actions={<NewCostCenterSheet />}
      />

      {items.length === 0 ? (
        <Card className="border-dashed py-14">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
              <Building2 className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Nenhum centro de custo</p>
              <p className="text-sm text-muted-foreground">
                Crie centros para filtrar lançamentos e contas por contexto.
              </p>
            </div>
            <NewCostCenterSheet />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Centros
            </p>
            <span className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? 'centro' : 'centros'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((row) => (
              <CostCenterTile key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CostCentersPageClient(): React.ReactElement {
  const query = useQuery({
    queryKey: queryKeys.costCenters(),
    queryFn: () => api.costCenters.list(),
  });

  return (
    <QueryBoundary
      query={query}
      skeleton={<PageSkeleton showActions showTable={false} kpiCount={0} />}
    >
      {(data) => <CostCentersContent data={data} />}
    </QueryBoundary>
  );
}
