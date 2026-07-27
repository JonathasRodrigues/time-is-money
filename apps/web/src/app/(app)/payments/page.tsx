export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import {
  estimatePayableCents,
  formatBrlFromCents,
  resolvePayableKind,
  suggestAverageAmountCents,
} from '@tim/domain';
import { accounts, categories, costCenters, transactions } from '@tim/db';
import { and, asc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/ui/submit-button';
import { ensurePaymentInstancesAction } from '@/server/actions';
import { createAppContext } from '@/server/context';
import { getAuthSession, getDb } from '@/server/db';
import { ensureSeriesInstancesForMonth } from '@tim/application';
import { PaydayReadyBanner } from '@/components/income-receipt-banner';
import { NewPayableSheet } from '@/components/new-payable-sheet';
import { NewReceivableSheet } from '@/components/new-receivable-sheet';
import { PaymentFilters } from '@/components/payment-filters';
import { PaymentsTable } from '@/components/payments-table';
import { TablePageSkeleton } from '@/components/page-skeletons';
import { cn } from '@/lib/utils';
import {
  resolveCostCenterId,
  resolveDateRangeWithLegacyMonth,
  yearMonthsBetween,
} from '@/lib/scope-query';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type Flow = 'pay' | 'receive';

function buildFlowHref(
  flow: Flow,
  params: {
    center?: string;
    kind?: string;
    month?: string;
    period?: string;
    from?: string;
    to?: string;
    payday?: string;
  },
): string {
  const qs = new URLSearchParams();
  if (flow === 'receive') qs.set('flow', 'receive');
  if (params.center) qs.set('center', params.center);
  if (params.kind) qs.set('kind', params.kind);
  if (params.period) qs.set('period', params.period);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.month) qs.set('month', params.month);
  if (params.payday === '1') qs.set('payday', '1');
  const query = qs.toString();
  return query ? `/payments?${query}` : '/payments';
}

type SearchParams = {
  center?: string;
  kind?: string;
  month?: string;
  period?: string;
  from?: string;
  to?: string;
  payday?: string;
  flow?: string;
};

export default function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): React.ReactElement {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <PaymentsView searchParams={searchParams} />
    </Suspense>
  );
}

async function PaymentsView({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');

  const params = await searchParams;
  const flow: Flow = params.flow === 'receive' || params.payday === '1' ? 'receive' : 'pay';
  const txType = flow === 'receive' ? 'income' : 'expense';
  const fromPayday = params.payday === '1';
  const range = resolveDateRangeWithLegacyMonth(params);
  const { start, end } = range;
  const today = todayIso();
  const kindFilter =
    params.kind === 'fixed' || params.kind === 'variable' || params.kind === 'installment'
      ? params.kind
      : undefined;

  const ctx = await createAppContext();
  try {
    for (const yearMonth of yearMonthsBetween(start, end)) {
      await ensureSeriesInstancesForMonth(ctx, yearMonth);
    }
  } catch {
    // viewer ou falha de escrita — a fila ainda lista o que já existe
  }

  const db = getDb();
  const [centers, cats, accs] = await Promise.all([
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(categories).where(eq(categories.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
  ]);

  const centerId = resolveCostCenterId(params.center, new Set(centers.map((c) => c.id)));

  const expenseCats = cats.filter((c) => c.type === 'expense');
  const incomeCats = cats.filter((c) => c.type === 'income');
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  const monthRows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        isNull(transactions.deletedAt),
        eq(transactions.type, txType),
        centerId ? eq(transactions.costCenterId, centerId) : undefined,
        gte(transactions.dueOn, start),
        lte(transactions.dueOn, end),
      ),
    )
    .orderBy(asc(transactions.dueOn));

  const pending = monthRows.filter((row) => row.status === 'pending');
  const paid = monthRows.filter((row) => row.status === 'paid');

  const history = await db
    .select({
      categoryId: transactions.categoryId,
      costCenterId: transactions.costCenterId,
      amountCents: transactions.amountCents,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        isNull(transactions.deletedAt),
        eq(transactions.status, 'paid'),
        eq(transactions.type, txType),
        isNotNull(transactions.amountCents),
      ),
    )
    .limit(500);

  const suggestionKey = (categoryId: string, costCenterId: string): string =>
    `${categoryId}:${costCenterId}`;

  const historyByKey = new Map<string, number[]>();
  for (const row of history) {
    if (row.amountCents == null) continue;
    const key = suggestionKey(row.categoryId, row.costCenterId);
    const list = historyByKey.get(key) ?? [];
    list.push(row.amountCents);
    historyByKey.set(key, list);
  }

  const enrichedPending = pending
    .map((row) => {
      const kind = resolvePayableKind({
        seriesId: row.seriesId,
        installmentId: row.installmentId,
      });
      const suggestedCents = suggestAverageAmountCents(
        historyByKey.get(suggestionKey(row.categoryId, row.costCenterId)) ?? [],
      );
      return {
        ...row,
        kind,
        suggestedCents,
        estimatedCents: estimatePayableCents({
          amountCents: row.amountCents,
          suggestedCents,
        }),
      };
    })
    .filter((row) => !kindFilter || row.kind === kindFilter);

  const knownPending = enrichedPending
    .filter((row) => row.amountCents != null)
    .reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const estimatedGap = enrichedPending
    .filter((row) => row.amountCents == null)
    .reduce((sum, row) => sum + row.estimatedCents, 0);
  const paidTotal = paid.reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const remaining = knownPending + estimatedGap;

  const filteredAccounts = centerId ? accs.filter((a) => a.costCenterId === centerId) : accs;
  const sheetAccounts = (filteredAccounts.length ? filteredAccounts : accs).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const isReceive = flow === 'receive';

  return (
    <div className="flex flex-col gap-6">
      {fromPayday ? <PaydayReadyBanner /> : null}
      <PageHeader
        title="Contas"
        description={
          isReceive ? `O que falta receber · ${range.label}` : `O que falta pagar · ${range.label}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ActionForm
              action={ensurePaymentInstancesAction}
              successMessage={isReceive ? 'Receitas fixas atualizadas' : 'Contas fixas atualizadas'}
            >
              <SubmitButton variant="outline" size="sm" pendingLabel="Atualizando…">
                Atualizar fixas
              </SubmitButton>
            </ActionForm>
            {isReceive ? (
              <NewReceivableSheet
                centers={centers.map((c) => ({ id: c.id, name: c.name }))}
                incomeCategories={incomeCats.map((c) => ({ id: c.id, name: c.name }))}
                accounts={sheetAccounts}
                defaultCostCenterId={centerId ?? centers[0]?.id}
                defaultDate={today}
              />
            ) : (
              <NewPayableSheet
                centers={centers.map((c) => ({ id: c.id, name: c.name }))}
                expenseCategories={expenseCats.map((c) => ({ id: c.id, name: c.name }))}
                accounts={sheetAccounts}
                defaultCostCenterId={centerId ?? centers[0]?.id}
                defaultDueOn={today}
              />
            )}
          </div>
        }
      />

      <div
        className="inline-flex w-fit rounded-lg border bg-muted/40 p-1"
        role="tablist"
        aria-label="A pagar ou a receber"
      >
        <Link
          href={buildFlowHref('pay', params)}
          role="tab"
          aria-selected={!isReceive}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            !isReceive
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          A pagar
        </Link>
        <Link
          href={buildFlowHref('receive', params)}
          role="tab"
          aria-selected={isReceive}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            isReceive
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          A receber
        </Link>
      </div>

      <PaymentFilters
        centers={centers.map((center) => ({ id: center.id, name: center.name }))}
        range={range}
        activeCenterId={centerId}
        activeKind={kindFilter ?? null}
        customFrom={params.from}
        customTo={params.to}
        payday={fromPayday}
        flow={flow}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">
            {isReceive ? 'Já recebido no período' : 'Já pago no período'}
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(paidTotal)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Com valor certo</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(knownPending)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Estimado (sem valor)</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(estimatedGap)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">
            {isReceive ? 'Falta receber' : 'Falta pagar'}
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
            {formatBrlFromCents(remaining)}
          </p>
        </div>
      </div>

      <Card className="gap-4 py-5">
        <CardHeader className="px-5 pb-0">
          <CardTitle>{isReceive ? 'A receber' : 'A pagar'}</CardTitle>
          <CardDescription>
            {isReceive
              ? 'Selecione várias para confirmar o recebimento · Fixa = todo mês · Variável = pontual'
              : 'Selecione várias para pagar de uma vez · Fixa = todo mês · Variável = pontual · Parcela = financiamento'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <PaymentsTable
            mode={isReceive ? 'receive' : 'pay'}
            today={today}
            rows={enrichedPending.map((row) => ({
              id: row.id,
              dueOn: row.dueOn,
              description: row.description,
              kind: row.kind,
              costCenterName: centerMap.get(row.costCenterId) ?? '—',
              categoryName: catMap.get(row.categoryId) ?? 'Categoria',
              amountCents: row.amountCents,
              suggestedCents: row.suggestedCents,
              estimatedCents: row.estimatedCents,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
