export const dynamic = 'force-dynamic';

import { formatBrlFromCents, formatIsoDateBr, transactionStatusLabel } from '@tim/domain';
import { accounts, categories, costCenters, transactions } from '@tim/db';
import { can } from '@tim/auth';
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, sql, sum } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { EditTransactionDialog } from '@/components/edit-transaction-dialog';
import { NewTransactionSheet } from '@/components/new-transaction-sheet';
import { ExtratoFilters } from '@/components/extrato-filters';
import { PageHeader } from '@/components/page-header';
import { resolveCostCenterId, resolveDateRange } from '@/lib/scope-query';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAuthSession, getDb } from '@/server/db';

const LIST_LIMIT = 500;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    center?: string;
    period?: string;
    from?: string;
    to?: string;
    type?: string;
    status?: string;
    category?: string;
    q?: string;
  }>;
}): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');
  const db = getDb();
  const params = await searchParams;
  const range = resolveDateRange(params);
  const canEdit = can(session, 'transactions.write');

  const typeFilter = params.type === 'income' || params.type === 'expense' ? params.type : null;
  const statusFilter =
    params.status === 'pending' || params.status === 'paid' ? params.status : null;
  const searchQuery = (params.q ?? '').trim();

  const [centers, cats, accs] = await Promise.all([
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(categories).where(eq(categories.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
  ]);

  const centerId = resolveCostCenterId(params.center, new Set(centers.map((center) => center.id)));
  const categoryIds = new Set(cats.map((category) => category.id));
  const categoryFilter =
    params.category && categoryIds.has(params.category) ? params.category : null;
  const activeCenterName = centerId
    ? (centers.find((center) => center.id === centerId)?.name ?? null)
    : null;

  const filteredAccounts = centerId
    ? accs.filter((account) => account.costCenterId === centerId)
    : accs;

  const filters = and(
    eq(transactions.householdId, session.householdId),
    isNull(transactions.deletedAt),
    centerId ? eq(transactions.costCenterId, centerId) : undefined,
    typeFilter ? eq(transactions.type, typeFilter) : undefined,
    statusFilter ? eq(transactions.status, statusFilter) : undefined,
    categoryFilter ? eq(transactions.categoryId, categoryFilter) : undefined,
    searchQuery ? ilike(transactions.description, `%${searchQuery}%`) : undefined,
    gte(transactions.occurredOn, range.start),
    lte(transactions.occurredOn, range.end),
  );

  const [rows, totalsRow] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(filters)
      .orderBy(desc(transactions.occurredOn), asc(transactions.description))
      .limit(LIST_LIMIT),
    db
      .select({
        total: count(),
        incomeCents: sum(
          sql`case when ${transactions.type} = 'income' and ${transactions.amountCents} is not null then ${transactions.amountCents} else 0 end`,
        ),
        expenseCents: sum(
          sql`case when ${transactions.type} = 'expense' and ${transactions.amountCents} is not null then ${transactions.amountCents} else 0 end`,
        ),
      })
      .from(transactions)
      .where(filters),
  ]);

  const totalCount = Number(totalsRow[0]?.total ?? 0);
  const incomeCents = Number(totalsRow[0]?.incomeCents ?? 0);
  const expenseCents = Number(totalsRow[0]?.expenseCents ?? 0);
  const truncated = totalCount > rows.length;

  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const scopeLabel = [range.label, activeCenterName].filter(Boolean).join(' · ');

  const centerOptions = centers.map((c) => ({ id: c.id, name: c.name }));
  const categoryOptions = cats.map((c) => ({ id: c.id, name: c.name, type: c.type }));
  const accountOptions = (filteredAccounts.length > 0 ? filteredAccounts : accs).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Extrato"
        description={`${totalCount} movimento${totalCount === 1 ? '' : 's'} · ${scopeLabel}`}
        actions={
          canEdit ? (
            <NewTransactionSheet
              centers={centerOptions}
              categories={categoryOptions}
              accounts={accountOptions}
              defaultCostCenterId={centerId ?? centers[0]?.id}
              defaultOccurredOn={range.end}
            />
          ) : null
        }
      />

      <ExtratoFilters
        centers={centers.map((center) => ({ id: center.id, name: center.name }))}
        categories={cats.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }))}
        range={range}
        activeCenterId={centerId}
        activeType={typeFilter}
        activeStatus={statusFilter}
        activeCategoryId={categoryFilter}
        activeQuery={searchQuery}
        customFrom={params.from}
        customTo={params.to}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Receitas</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
            +{formatBrlFromCents(incomeCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Despesas</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            −{formatBrlFromCents(expenseCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(incomeCents - expenseCents)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <p className="text-sm text-muted-foreground">
            {formatIsoDateBr(range.start)} – {formatIsoDateBr(range.end)}
            {truncated ? ` · ${rows.length} de ${totalCount}` : null}
          </p>
        </div>
        <div className="overflow-x-auto">
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
                rows.map((row) => {
                  const displayDate =
                    row.status === 'paid'
                      ? (row.paidOn ?? row.occurredOn)
                      : (row.dueOn ?? row.occurredOn);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="pl-4 tabular-nums text-muted-foreground sm:pl-5">
                        <span>{formatIsoDateBr(displayDate)}</span>
                        <span className="mt-0.5 block text-[10px] uppercase tracking-wide opacity-70">
                          {row.status === 'paid'
                            ? row.type === 'income'
                              ? 'recebimento'
                              : 'pagamento'
                            : 'vencimento'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate font-medium">
                        {row.description || catMap.get(row.categoryId) || 'Lançamento'}
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
                      <TableCell>{centerMap.get(row.costCenterId) ?? '—'}</TableCell>
                      <TableCell>{catMap.get(row.categoryId) ?? '—'}</TableCell>
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
                            centers={centerOptions}
                            categories={categoryOptions}
                            accounts={accs.map((a) => ({ id: a.id, name: a.name }))}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
