'use client';

import { useRouter } from 'next/navigation';
import {
  FilterBar,
  FilterDateRangePicker,
  FilterField,
  FilterSelect,
  centerFilterOptions,
} from '@/components/filters';
import { buildScopeHref, type DateRange, type ScopeQuery } from '@/lib/scope-query';

/** Filtros de período + centro (Dashboard). */
export function ScopeFilters({
  centers,
  activeCenterId,
  range,
  basePath,
  customFrom,
  customTo,
  extras,
}: {
  centers: Array<{ id: string; name: string }>;
  activeCenterId: string | null;
  range: DateRange;
  basePath: string;
  customFrom?: string;
  customTo?: string;
  extras?: Pick<ScopeQuery, 'type' | 'status' | 'category' | 'q'>;
}): React.ReactElement {
  const router = useRouter();

  const baseQuery: ScopeQuery = {
    center: activeCenterId,
    period: range.period,
    from: customFrom ?? range.start,
    to: customTo ?? range.end,
    type: extras?.type,
    status: extras?.status,
    category: extras?.category,
    q: extras?.q,
  };

  function push(query: ScopeQuery) {
    router.push(buildScopeHref(basePath, query), { scroll: false });
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
            push({
              ...baseQuery,
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
          onValueChange={(value) =>
            push({
              ...baseQuery,
              center: value === 'all' ? null : value,
            })
          }
          options={centerFilterOptions(centers)}
        />
      </FilterField>
    </FilterBar>
  );
}
