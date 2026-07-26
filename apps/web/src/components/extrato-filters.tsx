'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  FilterBar,
  FilterDateRangePicker,
  FilterField,
  FilterSearch,
  FilterSelect,
  centerFilterOptions,
} from '@/components/filters';
import { buildScopeHref, type DateRange, type ScopeQuery } from '@/lib/scope-query';

/** Filtros do Extrato — barra flat + date range picker. */
export function ExtratoFilters({
  centers,
  categories,
  range,
  activeCenterId,
  activeType,
  activeStatus,
  activeCategoryId,
  activeQuery,
  customFrom,
  customTo,
}: {
  centers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' }>;
  range: DateRange;
  activeCenterId: string | null;
  activeType: 'income' | 'expense' | null;
  activeStatus: 'pending' | 'paid' | null;
  activeCategoryId: string | null;
  activeQuery: string;
  customFrom?: string;
  customTo?: string;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const categoryOptions = activeType
    ? categories.filter((category) => category.type === activeType)
    : categories;

  const base: ScopeQuery = {
    center: activeCenterId,
    period: range.period,
    from: customFrom ?? range.start,
    to: customTo ?? range.end,
    type: activeType,
    status: activeStatus,
    category: activeCategoryId,
    q: activeQuery || null,
  };

  function navigate(patch: Partial<ScopeQuery>) {
    startTransition(() => {
      const next: ScopeQuery = { ...base, ...patch };
      if (patch.type !== undefined && patch.type !== activeType) {
        const stillValid =
          next.category != null &&
          categories.some(
            (category) =>
              category.id === next.category && (patch.type == null || category.type === patch.type),
          );
        if (!stillValid) next.category = null;
      }
      router.push(buildScopeHref('/transactions', next), { scroll: false });
    });
  }

  return (
    <FilterBar>
      <FilterField label="Período">
        <FilterDateRangePicker
          value={{
            period: range.period,
            from: customFrom ?? (range.period === 'custom' ? range.start : undefined),
            to: customTo ?? (range.period === 'custom' ? range.end : undefined),
          }}
          onChange={(next) =>
            navigate({
              period: next.period,
              from: next.from,
              to: next.to,
            })
          }
          className="min-w-[11.5rem]"
        />
      </FilterField>

      <FilterField label="Centro">
        <FilterSelect
          ariaLabel="Centro de custo"
          value={activeCenterId ?? 'all'}
          onValueChange={(value) => navigate({ center: value === 'all' ? null : value })}
          options={centerFilterOptions(centers)}
        />
      </FilterField>

      <FilterField label="Tipo">
        <FilterSelect
          ariaLabel="Tipo"
          value={activeType ?? 'all'}
          onValueChange={(value) =>
            navigate({
              type: value === 'all' ? null : (value as 'income' | 'expense'),
            })
          }
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'expense', label: 'Despesas' },
            { value: 'income', label: 'Receitas' },
          ]}
        />
      </FilterField>

      <FilterField label="Status">
        <FilterSelect
          ariaLabel="Status"
          value={activeStatus ?? 'all'}
          onValueChange={(value) =>
            navigate({
              status: value === 'all' ? null : (value as 'pending' | 'paid'),
            })
          }
          options={[
            { value: 'all', label: 'Todos' },
            ...(activeType === 'income'
              ? [
                  { value: 'paid', label: 'Recebido' },
                  { value: 'pending', label: 'A receber' },
                ]
              : activeType === 'expense'
                ? [
                    { value: 'paid', label: 'Pago' },
                    { value: 'pending', label: 'A pagar' },
                  ]
                : [
                    { value: 'paid', label: 'Concluído' },
                    { value: 'pending', label: 'Pendente' },
                  ]),
          ]}
        />
      </FilterField>

      <FilterField label="Categoria">
        <FilterSelect
          ariaLabel="Categoria"
          value={activeCategoryId ?? 'all'}
          onValueChange={(value) => navigate({ category: value === 'all' ? null : value })}
          triggerClassName="min-w-[12rem]"
          options={[
            { value: 'all', label: 'Todas' },
            ...categoryOptions.map((category) => ({
              value: category.id,
              label: activeType
                ? category.name
                : `${category.name} (${category.type === 'income' ? 'receita' : 'despesa'})`,
            })),
          ]}
        />
      </FilterField>

      <FilterField label="Busca" className="min-w-[12rem] flex-1 sm:max-w-xs">
        <FilterSearch
          value={activeQuery}
          placeholder="Descrição…"
          ariaLabel="Buscar no extrato"
          onSubmit={(q) => navigate({ q: q || null })}
        />
      </FilterField>

      {pending ? (
        <span className="sr-only" aria-live="polite">
          Atualizando filtros
        </span>
      ) : null}
    </FilterBar>
  );
}
