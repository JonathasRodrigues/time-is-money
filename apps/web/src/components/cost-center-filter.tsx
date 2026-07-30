'use client';

import { useRouter } from 'next/navigation';
import { FilterBar, FilterField, FilterSelect, centerFilterOptions } from '@/components/filters';
import { useSoftNavigate } from '@/components/navigating';
import { useScopePreference } from '@/components/scope-preference';
import { buildScopeHref, type PeriodKey } from '@/lib/scope-query';

/** Filtro de centro — mesmo padrão visual das demais telas. */
export function CostCenterFilter({
  centers,
  activeId,
  basePath,
  period,
  from,
  to,
}: {
  centers: Array<{ id: string; name: string }>;
  activeId: string | null;
  basePath: string;
  period?: PeriodKey;
  from?: string;
  to?: string;
}): React.ReactElement {
  const router = useRouter();
  const { isPending, navigate } = useSoftNavigate();
  const { rememberScope } = useScopePreference();

  return (
    <FilterBar pending={isPending}>
      <FilterField label="Centro">
        <FilterSelect
          ariaLabel="Centro de custo"
          value={activeId ?? 'all'}
          onValueChange={(value) => {
            const center = value === 'all' ? null : value;
            rememberScope({ center, period, from, to });
            navigate(() => {
              router.push(
                buildScopeHref(basePath, {
                  center,
                  period,
                  from,
                  to,
                }),
                { scroll: false },
              );
            });
          }}
          options={centerFilterOptions(centers)}
        />
      </FilterField>
    </FilterBar>
  );
}
