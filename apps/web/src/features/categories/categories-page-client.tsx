'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CategoriesResponse } from '@tim/api-contract';
import { FolderTree } from 'lucide-react';
import { NewCategorySheet } from '@/components/new-category-sheet';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { PageSkeleton } from '@/components/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';
import { cn } from '@/lib/utils';

type CategoryFilter = 'all' | 'expense' | 'income';

const FILTERS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
];

type CategoryRow = CategoriesResponse['items'][number];

function CategoriesContent({ data }: { data: CategoriesResponse }): React.ReactElement {
  const { items } = data;
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((row) => row.type === filter);
  }, [items, filter]);

  const expenseCount = items.filter((row) => row.type === 'expense').length;
  const incomeCount = items.filter((row) => row.type === 'income').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categorias"
        description="Receitas e despesas do household — seed padrão + as que você criar."
        actions={<NewCategorySheet />}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge
              variant={filter === item.value ? 'default' : 'secondary'}
              className={cn('cursor-pointer px-3 py-1')}
            >
              {item.label}
              {item.value === 'expense'
                ? ` · ${expenseCount}`
                : item.value === 'income'
                  ? ` · ${incomeCount}`
                  : ` · ${items.length}`}
            </Badge>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed py-14">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
              <FolderTree className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Nenhuma categoria</p>
              <p className="text-sm text-muted-foreground">
                Adicione categorias além do seed para organizar lançamentos.
              </p>
            </div>
            <NewCategorySheet />
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Lista</CardTitle>
              <CardDescription>
                {filtered.length} {filtered.length === 1 ? 'categoria' : 'categorias'}
                {filter !== 'all'
                  ? ` · filtro ${filter === 'income' ? 'receitas' : 'despesas'}`
                  : ''}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="divide-y px-0">
            {filtered.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhuma categoria neste filtro.
              </p>
            ) : (
              filtered.map((row) => <CategoryListRow key={row.id} row={row} />)
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CategoryListRow({ row }: { row: CategoryRow }): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium tracking-tight">{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.isSystem ? 'Seed do sistema' : 'Personalizada'}
        </p>
      </div>
      <Badge variant="outline" className="font-normal">
        {row.type === 'income' ? 'Receita' : 'Despesa'}
      </Badge>
    </div>
  );
}

export function CategoriesPageClient(): React.ReactElement {
  const query = useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => api.categories.list(),
  });

  return (
    <QueryBoundary
      query={query}
      skeleton={<PageSkeleton showActions showTable={false} kpiCount={0} />}
    >
      {(data) => <CategoriesContent data={data} />}
    </QueryBoundary>
  );
}
