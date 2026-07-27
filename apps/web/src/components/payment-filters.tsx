'use client';

import { useRouter } from 'next/navigation';
import {
  FilterBar,
  FilterDateRangePicker,
  FilterField,
  FilterSelect,
  centerFilterOptions,
} from '@/components/filters';
import { useSoftNavigate } from '@/components/navigating';
import { buildScopeHref, type DateRange, type ScopeQuery } from '@/lib/scope-query';

const KIND_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'fixed', label: 'Fixas' },
  { value: 'variable', label: 'Variáveis' },
  { value: 'installment', label: 'Parcelas' },
] as const;

function buildPaymentsHref(
  query: ScopeQuery & { kind?: string | null; payday?: boolean; flow?: 'pay' | 'receive' },
): string {
  const href = buildScopeHref('/payments', query);
  const params = new URLSearchParams(href.includes('?') ? href.split('?')[1] : '');
  if (query.kind) params.set('kind', query.kind);
  if (query.payday) params.set('payday', '1');
  if (query.flow === 'receive') params.set('flow', 'receive');
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
  flow = 'pay',
}: {
  centers: Array<{ id: string; name: string }>;
  range: DateRange;
  activeCenterId: string | null;
  activeKind: 'fixed' | 'variable' | 'installment' | null;
  customFrom?: string;
  customTo?: string;
  payday?: boolean;
  flow?: 'pay' | 'receive';
}): React.ReactElement {
  const router = useRouter();
  const { isPending, navigate } = useSoftNavigate();

  const base: ScopeQuery & { kind: string | null; payday: boolean; flow: 'pay' | 'receive' } = {
    center: activeCenterId,
    period: range.period,
    from: customFrom ?? range.start,
    to: customTo ?? range.end,
    kind: activeKind,
    payday,
    flow,
  };

  function go(patch: Partial<typeof base>): void {
    navigate(() => {
      router.push(buildPaymentsHref({ ...base, ...patch }), { scroll: false });
    });
  }

  return (
    <FilterBar pending={isPending}>
      <FilterField label="Período">
        <FilterDateRangePicker
          value={{
            period: range.period,
            from: customFrom ?? (range.period === 'custom' ? range.start : undefined),
            to: customTo ?? (range.period === 'custom' ? range.end : undefined),
          }}
          onChange={(next) =>
            go({
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
          onValueChange={(value) => go({ center: value === 'all' ? null : value })}
          options={centerFilterOptions(centers)}
        />
      </FilterField>

      <FilterField label="Tipo">
        <FilterSelect
          ariaLabel="Tipo de obrigação"
          value={activeKind ?? 'all'}
          onValueChange={(value) => go({ kind: value === 'all' ? null : value })}
          options={[...KIND_OPTIONS]}
        />
      </FilterField>
    </FilterBar>
  );
}
