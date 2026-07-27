import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function PageHeaderSkeleton({
  showActions = false,
}: {
  showActions?: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-9 w-48 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      {showActions ? <Skeleton className="h-9 w-28 rounded-md" /> : null}
    </div>
  );
}

function FilterBarSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-36 rounded-md" />
      ))}
    </div>
  );
}

const kpiGridClass: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
};

function KpiRowSkeleton({ count = 3 }: { count?: number }): React.ReactElement {
  return (
    <div className={cn('grid gap-3', kpiGridClass[count] ?? 'sm:grid-cols-3')}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-28" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3 sm:px-5">
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-4 w-40 max-w-[40%] flex-1" />
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardGridSkeleton({ count = 2 }: { count?: number }): React.ReactElement {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card p-5 shadow-sm">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
          <Skeleton className="mt-6 h-40 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Fallback leve para rotas sem skeleton dedicado (cadastros, settings, etc.). */
export function PageSkeleton({
  showActions = false,
  showFilters = false,
  kpiCount = 0,
  showTable = true,
  tableRows = 8,
}: {
  showActions?: boolean;
  showFilters?: boolean;
  kpiCount?: number;
  showTable?: boolean;
  tableRows?: number;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando página">
      <PageHeaderSkeleton showActions={showActions} />
      {showFilters ? <FilterBarSkeleton /> : null}
      {kpiCount > 0 ? <KpiRowSkeleton count={kpiCount} /> : null}
      {showTable ? <TableSkeleton rows={tableRows} /> : null}
    </div>
  );
}

/** Dashboard — espelha a hierarquia real sem exagerar altura. */
export function DashboardPageSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando dashboard">
      <PageHeaderSkeleton />
      <FilterBarSkeleton />
      <KpiRowSkeleton count={3} />
      <KpiRowSkeleton count={3} />
      <CardGridSkeleton count={2} />
      <TableSkeleton rows={5} />
    </div>
  );
}

/** Extrato / Contas — filtros, KPIs e tabela. */
export function TablePageSkeleton({
  showActions = true,
}: {
  showActions?: boolean;
}): React.ReactElement {
  return (
    <PageSkeleton showActions={showActions} showFilters kpiCount={3} showTable tableRows={10} />
  );
}

/** Financiamentos, planejamento, patrimônio — grid de cards. */
export function CardsPageSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando página">
      <PageHeaderSkeleton showActions />
      <FilterBarSkeleton />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-xl border bg-card p-5 shadow-sm">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-4 w-28" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
            <div className="mt-4 flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
