'use client';

import { useQuery } from '@tanstack/react-query';
import type { TransactionsResponse } from '@tim/api-contract';
import { formatBrlFromCents, formatIsoDateBr, transactionStatusLabel } from '@tim/domain';
import dynamic from 'next/dynamic';
import { ExtratoFilters } from '@/components/extrato-filters';
import { NewTransactionSheet } from '@/components/new-transaction-sheet';
import { MobileDataCard, MobileDataEmpty, MobileDataList } from '@/components/mobile-data-list';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { TablePageSkeleton } from '@/components/page-skeletons';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSearchParamsRecord } from '@/hooks/use-search-params-record';
import { api } from '@/lib/api/endpoints';
import { toDateRange } from '@/lib/api/period';
import { queryKeys } from '@/lib/api/query-keys';

const EditTransactionDialog = dynamic(
  () =>
    import('@/components/edit-transaction-dialog').then((mod) => ({
      default: mod.EditTransactionDialog,
    })),
  { loading: () => null },
);

function TransactionsContent({ data }: { data: TransactionsResponse }): React.ReactElement {
  const { canEdit, range, scopeLabel, totals, rows, filters, lookups } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Extrato"
        description={`${totals.totalCount} movimento${totals.totalCount === 1 ? '' : 's'} · ${scopeLabel}`}
        actions={
          canEdit ? (
            <NewTransactionSheet
              centers={lookups.centers}
              categories={lookups.categories}
              accounts={lookups.accounts}
              creditCards={lookups.creditCards}
              defaultCostCenterId={lookups.defaultCostCenterId}
              defaultOccurredOn={lookups.defaultOccurredOn}
            />
          ) : null
        }
      />

      <ExtratoFilters
        centers={lookups.centers}
        categories={lookups.categories}
        banks={lookups.banks}
        accounts={lookups.accounts}
        creditCards={lookups.creditCards}
        range={toDateRange(range)}
        activeCenterId={filters.centerId}
        activeType={filters.typeFilter}
        activeStatus={filters.statusFilter}
        activeCategoryId={filters.categoryFilter}
        activeBankId={filters.bankFilter}
        activeAccountId={filters.accountFilter}
        activeRail={filters.railFilter}
        activeCardId={filters.cardFilter}
        activeQuery={filters.searchQuery}
        customFrom={range.period === 'custom' ? range.start : undefined}
        customTo={range.period === 'custom' ? range.end : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Receitas</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
            +{formatBrlFromCents(totals.incomeCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Despesas</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            −{formatBrlFromCents(totals.expenseCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(totals.incomeCents - totals.expenseCents)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <p className="text-sm text-muted-foreground">
            {formatIsoDateBr(range.start)} – {formatIsoDateBr(range.end)}
            {totals.truncated ? ` · ${rows.length} de ${totals.totalCount}` : null}
          </p>
        </div>

        <MobileDataList
          empty={
            rows.length === 0 ? (
              <MobileDataEmpty>
                Nenhum movimento neste filtro. Use <span className="font-medium">Novo</span> para
                registrar.
              </MobileDataEmpty>
            ) : undefined
          }
        >
          {rows.map((row) => {
            const dateKind =
              row.displayDateKind === 'receipt'
                ? 'recebimento'
                : row.displayDateKind === 'payment'
                  ? 'pagamento'
                  : 'vencimento';

            return (
              <MobileDataCard
                key={`m-${row.id}`}
                title={row.description || row.categoryName || 'Lançamento'}
                subtitle={`${row.categoryName}${row.costCenterName ? ` · ${row.costCenterName}` : ''}`}
                amount={
                  row.amountCents == null ? (
                    '—'
                  ) : (
                    <>
                      {row.type === 'income' ? '+' : '−'}
                      {formatBrlFromCents(row.amountCents)}
                    </>
                  )
                }
                amountTone={
                  row.amountCents == null ? 'muted' : row.type === 'income' ? 'income' : 'expense'
                }
                badges={
                  <>
                    <Badge variant="outline">{row.type === 'income' ? 'Receita' : 'Despesa'}</Badge>
                    <Badge variant={row.status === 'pending' ? 'secondary' : 'outline'}>
                      {transactionStatusLabel(row.type, row.status)}
                    </Badge>
                  </>
                }
                meta={`${formatIsoDateBr(row.displayDate)} · ${dateKind}`}
                actions={
                  canEdit ? (
                    <EditTransactionDialog
                      transaction={{
                        id: row.id,
                        type: row.type,
                        status: row.status,
                        amountCents: row.amountCents,
                        occurredOn: row.occurredOn,
                        dueOn: row.dueOn,
                        paidOn: row.paidOn,
                        description: row.description,
                        costCenterId: row.costCenterId,
                        categoryId: row.categoryId,
                        accountId: row.accountId,
                        installmentId: row.installmentId,
                      }}
                      centers={lookups.centers}
                      categories={lookups.categories}
                      accounts={lookups.accounts}
                    />
                  ) : null
                }
              />
            );
          })}
        </MobileDataList>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 sm:pl-5">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {canEdit ? <TableHead className="pr-4 text-right sm:pr-5"> </TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 8 : 7}
                    className="h-28 text-center text-muted-foreground"
                  >
                    Nenhum movimento neste filtro. Use <span className="font-medium">Novo</span>{' '}
                    para registrar.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-4 tabular-nums text-muted-foreground sm:pl-5">
                      <span>{formatIsoDateBr(row.displayDate)}</span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-wide opacity-70">
                        {row.displayDateKind === 'receipt'
                          ? 'recebimento'
                          : row.displayDateKind === 'payment'
                            ? 'pagamento'
                            : 'vencimento'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate font-medium">
                      {row.description || row.categoryName || 'Lançamento'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {row.type === 'income' ? 'Receita' : 'Despesa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'pending' ? 'secondary' : 'outline'}>
                        {transactionStatusLabel(row.type, row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.costCenterName}</TableCell>
                    <TableCell>{row.categoryName}</TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        row.type === 'income' ? 'text-primary' : ''
                      } ${canEdit ? '' : 'pr-4 sm:pr-5'}`}
                    >
                      {row.amountCents == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          {row.type === 'income' ? '+' : '−'}
                          {formatBrlFromCents(row.amountCents)}
                        </>
                      )}
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="pr-2 text-right sm:pr-3">
                        <EditTransactionDialog
                          transaction={{
                            id: row.id,
                            type: row.type,
                            status: row.status,
                            amountCents: row.amountCents,
                            occurredOn: row.occurredOn,
                            dueOn: row.dueOn,
                            paidOn: row.paidOn,
                            description: row.description,
                            costCenterId: row.costCenterId,
                            categoryId: row.categoryId,
                            accountId: row.accountId,
                            installmentId: row.installmentId,
                          }}
                          centers={lookups.centers}
                          categories={lookups.categories}
                          accounts={lookups.accounts}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export function TransactionsPageClient(): React.ReactElement {
  const params = useSearchParamsRecord();
  const query = useQuery({
    queryKey: queryKeys.transactions(params),
    queryFn: () => api.transactions.list(params),
  });

  return (
    <QueryBoundary query={query} skeleton={<TablePageSkeleton />}>
      {(data) => <TransactionsContent data={data} />}
    </QueryBoundary>
  );
}
