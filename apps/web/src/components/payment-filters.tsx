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

const KIND_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'fixed', label: 'Fixas' },
  { value: 'variable', label: 'Variáveis' },
  { value: 'installment', label: 'Parcelas' },
] as const;

function buildPaymentsHref(query: ScopeQuery & { kind?: string | null; payday?: boolean }): string {
  const href = buildScopeHref('/payments', query);
  const params = new URLSearchParams(href.includes('?') ? href.split('?')[1] : '');
  if (query.kind) params.set('kind', query.kind);
  if (query.payday) params.set('payday', '1');
  const qs = params.toString();
  return qs ? `/payments?${qs}` : '/payments';
}

export function PaymentFilters({
  centers,
  range,
  activeCenterId,
  activeKind,
  customFrom,
  customTo,
  payday = false,
}: {
  centers: Array<{ id: string; name: string }>;
  range: DateRange;
  activeCenterId: string | null;
  activeKind: 'fixed' | 'variable' | 'installment' | null;
  customFrom?: string;
  customTo?: string;
  payday?: boolean;
}): React.ReactElement {
  const router = useRouter();

  const base: ScopeQuery & { kind: string | null; payday: boolean } = {
    center: activeCenterId,
    period: range.period,
    from: customFrom ?? range.start,
    to: customTo ?? range.end,
    kind: activeKind,
    payday,
  };

  function navigate(patch: Partial<typeof base>) {
    router.push(buildPaymentsHref({ ...base, ...patch }), { scroll: false });
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
          ariaLabel="Tipo de obrigação"
          value={activeKind ?? 'all'}
          onValueChange={(value) => navigate({ kind: value === 'all' ? null : value })}
          options={[...KIND_OPTIONS]}
        />
      </FilterField>
    </FilterBar>
  );
}
