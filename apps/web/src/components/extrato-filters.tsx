'use client';

import { PAYMENT_RAIL_LABEL, type PaymentRail } from '@tim/domain';
import { useRouter } from 'next/navigation';
import {
  FilterBar,
  FilterDateRangePicker,
  FilterField,
  FilterSearch,
  FilterSelect,
  centerFilterOptions,
} from '@/components/filters';
import { useSoftNavigate } from '@/components/navigating';
import { useScopePreference } from '@/components/scope-preference';
import { buildScopeHref, type DateRange, type ScopeQuery } from '@/lib/scope-query';

const PAYMENT_RAILS: PaymentRail[] = ['pix', 'debit', 'ted', 'boleto', 'cash', 'other'];

type RailFilter = PaymentRail | 'credit_card';

/** Filtros do Extrato — barra flat + date range picker. */
export function ExtratoFilters({
  centers,
  categories,
  banks,
  accounts,
  creditCards,
  range,
  activeCenterId,
  activeType,
  activeStatus,
  activeCategoryId,
  activeBankId,
  activeAccountId,
  activeRail,
  activeCardId,
  activeQuery,
  customFrom,
  customTo,
}: {
  centers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' }>;
  banks: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string; institutionId: string | null }>;
  creditCards: Array<{
    id: string;
    name: string;
    institutionId: string;
    lastFour?: string | null;
  }>;
  range: DateRange;
  activeCenterId: string | null;
  activeType: 'income' | 'expense' | null;
  activeStatus: 'pending' | 'paid' | null;
  activeCategoryId: string | null;
  activeBankId: string | null;
  activeAccountId: string | null;
  activeRail: RailFilter | null;
  activeCardId: string | null;
  activeQuery: string;
  customFrom?: string;
  customTo?: string;
}): React.ReactElement {
  const router = useRouter();
  const { isPending, navigate } = useSoftNavigate();
  const { rememberScope } = useScopePreference();

  const categoryOptions = activeType
    ? categories.filter((category) => category.type === activeType)
    : categories;

  const accountOptions = activeBankId
    ? accounts.filter((account) => account.institutionId === activeBankId)
    : accounts;

  const cardOptions = creditCards.filter((card) => {
    if (activeBankId && card.institutionId !== activeBankId) return false;
    if (activeAccountId) {
      const account = accounts.find((row) => row.id === activeAccountId);
      if (account?.institutionId && card.institutionId !== account.institutionId) return false;
    }
    return true;
  });

  const base: ScopeQuery = {
    center: activeCenterId,
    period: range.period,
    from: customFrom ?? range.start,
    to: customTo ?? range.end,
    type: activeType,
    status: activeStatus,
    category: activeCategoryId,
    bank: activeBankId,
    account: activeAccountId,
    rail: activeRail,
    card: activeCardId,
    q: activeQuery || null,
  };

  function go(patch: Partial<ScopeQuery>): void {
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
    if (patch.bank !== undefined && patch.bank !== activeBankId) {
      const accountStillValid =
        next.account != null &&
        accounts.some(
          (account) =>
            account.id === next.account &&
            (patch.bank == null || account.institutionId === patch.bank),
        );
      if (!accountStillValid) next.account = null;
      const cardStillValid =
        next.card != null &&
        creditCards.some(
          (card) =>
            card.id === next.card && (patch.bank == null || card.institutionId === patch.bank),
        );
      if (!cardStillValid) next.card = null;
    }
    if (patch.rail !== undefined && patch.rail !== 'credit_card' && patch.rail != null) {
      next.card = null;
    }
    rememberScope({
      period: next.period,
      from: next.from,
      to: next.to,
      center: next.center ?? null,
    });
    navigate(() => {
      router.push(buildScopeHref('/transactions', next), { scroll: false });
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

      {banks.length > 0 ? (
        <FilterField label="Banco">
          <FilterSelect
            ariaLabel="Banco"
            value={activeBankId ?? 'all'}
            onValueChange={(value) => go({ bank: value === 'all' ? null : value })}
            triggerClassName="min-w-[10rem]"
            options={[
              { value: 'all', label: 'Todos' },
              ...banks.map((bank) => ({ value: bank.id, label: bank.name })),
            ]}
          />
        </FilterField>
      ) : null}

      {accounts.length > 0 ? (
        <FilterField label="Conta">
          <FilterSelect
            ariaLabel="Conta"
            value={activeAccountId ?? 'all'}
            onValueChange={(value) => go({ account: value === 'all' ? null : value })}
            triggerClassName="min-w-[10rem]"
            options={[
              { value: 'all', label: 'Todas' },
              ...accountOptions.map((account) => ({
                value: account.id,
                label: account.name,
              })),
            ]}
          />
        </FilterField>
      ) : null}

      <FilterField label="Forma">
        <FilterSelect
          ariaLabel="Forma de pagamento"
          value={activeRail ?? 'all'}
          onValueChange={(value) =>
            go({
              rail: value === 'all' ? null : (value as RailFilter),
            })
          }
          triggerClassName="min-w-[9rem]"
          options={[
            { value: 'all', label: 'Todas' },
            ...PAYMENT_RAILS.map((rail) => ({
              value: rail,
              label: PAYMENT_RAIL_LABEL[rail],
            })),
            { value: 'credit_card', label: 'Cartão de crédito' },
          ]}
        />
      </FilterField>

      {creditCards.length > 0 ? (
        <FilterField label="Cartão">
          <FilterSelect
            ariaLabel="Cartão"
            value={activeCardId ?? 'all'}
            onValueChange={(value) =>
              go({
                card: value === 'all' ? null : value,
                rail: value === 'all' ? activeRail : 'credit_card',
              })
            }
            triggerClassName="min-w-[10rem]"
            options={[
              { value: 'all', label: 'Todos' },
              ...cardOptions.map((card) => ({
                value: card.id,
                label: card.lastFour ? `${card.name} •••• ${card.lastFour}` : card.name,
              })),
            ]}
          />
        </FilterField>
      ) : null}

      <FilterField label="Tipo">
        <FilterSelect
          ariaLabel="Tipo"
          value={activeType ?? 'all'}
          onValueChange={(value) =>
            go({
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
            go({
              status: value === 'all' ? null : (value as 'pending' | 'paid'),
            })
          }
          options={[
            { value: 'all', label: 'Todos' },
            ...(activeType === 'income'
              ? [
                  { value: 'paid', label: 'Recebido' },
                  { value: 'pending', label: 'Contas a receber' },
                ]
              : activeType === 'expense'
                ? [
                    { value: 'paid', label: 'Pago' },
                    { value: 'pending', label: 'Contas a pagar' },
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
          onValueChange={(value) => go({ category: value === 'all' ? null : value })}
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
          onSubmit={(q) => go({ q: q || null })}
        />
      </FilterField>
    </FilterBar>
  );
}
