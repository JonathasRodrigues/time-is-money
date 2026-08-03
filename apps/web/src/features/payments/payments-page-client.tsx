'use client';

import { useQuery } from '@tanstack/react-query';
import type { PaymentsResponse } from '@tim/api-contract';
import { formatBrlFromCents } from '@tim/domain';
import { CreditCard, ListChecks, Wallet } from 'lucide-react';
import { PaydayReadyBanner } from '@/components/income-receipt-banner';
import { NewPayableSheet } from '@/components/new-payable-sheet';
import { NewReceivableSheet } from '@/components/new-receivable-sheet';
import { PageHeader } from '@/components/page-header';
import { InvoicePayableGroups } from '@/components/invoice-payable-groups';
import { PaymentFilters } from '@/components/payment-filters';
import { PaymentsTable } from '@/components/payments-table';
import { SettledPaymentsTable } from '@/components/settled-payments-table';
import { TablePageSkeleton } from '@/components/page-skeletons';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSearchParamsRecord } from '@/hooks/use-search-params-record';
import { useMutationFeedback } from '@/hooks/use-mutation-feedback';
import { api } from '@/lib/api/endpoints';
import { toDateRange } from '@/lib/api/period';
import { queryKeys } from '@/lib/api/query-keys';
import { useEnsurePaymentInstances } from '@/features/payments/use-ensure-payment-instances';
import { cn } from '@/lib/utils';

function SectionLabel({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CreditCard;
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <div className="flex gap-3 px-5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function PaymentsContent({ data }: { data: PaymentsResponse }): React.ReactElement {
  const { run } = useMutationFeedback();
  const { flow, fromPayday, today, range, filters, totals, rows, settledRows, lookups } = data;
  const isReceive = flow === 'receive';
  const invoiceRows = rows.filter((row) => row.kind === 'credit_card_invoice');
  const billRows = rows.filter((row) => row.kind !== 'credit_card_invoice');
  const hasInvoices = !isReceive && invoiceRows.length > 0;
  const hasBills = billRows.length > 0;
  const pendingEmpty = !hasInvoices && !hasBills;

  const invoices = invoiceRows.flatMap((row) => {
    if (!row.creditCardId || row.amountCents == null) return [];
    return [
      {
        id: row.id,
        dueOn: row.dueOn,
        description: row.description,
        accountId: row.accountId,
        amountCents: row.amountCents,
        creditCardId: row.creditCardId,
        creditCardName: row.creditCardName,
        purchases: (row.purchases ?? []).map((purchase) => ({
          id: purchase.id,
          description: purchase.description,
          kind: purchase.kind,
          costCenterId: purchase.costCenterId,
          costCenterName: purchase.costCenterName,
          categoryId: purchase.categoryId,
          categoryName: purchase.categoryName,
          accountId: purchase.accountId,
          paymentRail: purchase.paymentRail,
          creditCardId: purchase.creditCardId,
          creditCardInvoiceId: purchase.creditCardInvoiceId,
          occurredOn: purchase.occurredOn,
          amountCents: purchase.amountCents,
        })),
      },
    ];
  });

  return (
    <div className="flex flex-col gap-6">
      {fromPayday ? <PaydayReadyBanner /> : null}
      <PageHeader
        title={isReceive ? 'Contas a receber' : 'Contas a pagar'}
        description={
          isReceive
            ? `Pendências de entrada · ${range.label}`
            : `Pendências do período · ${range.label}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void run(() => api.payments.ensureInstances({}), {
                  success: isReceive ? 'Receitas fixas atualizadas' : 'Contas fixas atualizadas',
                  loading: 'Atualizando…',
                  invalidate: 'money',
                })
              }
            >
              Atualizar fixas
            </Button>
            {isReceive ? (
              <NewReceivableSheet
                centers={lookups.centers}
                incomeCategories={lookups.incomeCategories}
                accounts={lookups.sheetAccounts}
                defaultCostCenterId={lookups.defaultCostCenterId ?? lookups.centers[0]?.id}
                defaultDate={today}
              />
            ) : (
              <NewPayableSheet
                centers={lookups.centers}
                expenseCategories={lookups.expenseCategories}
                accounts={lookups.sheetAccounts}
                paymentMethods={lookups.paymentMethods}
                creditCards={lookups.creditCards}
                defaultCostCenterId={lookups.defaultCostCenterId ?? lookups.centers[0]?.id}
                defaultDueOn={today}
              />
            )}
          </div>
        }
      />

      <PaymentFilters
        centers={lookups.centers}
        creditCards={lookups.creditCards}
        range={toDateRange(range)}
        activeCenterId={filters.centerId}
        activeKind={filters.kindFilter}
        activeCreditCardId={filters.creditCardId}
        customFrom={range.period === 'custom' ? range.start : undefined}
        customTo={range.period === 'custom' ? range.end : undefined}
        payday={fromPayday}
        flow={flow}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">{isReceive ? 'Já recebido' : 'Já pago'}</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(totals.paidTotalCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Com valor certo</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(totals.knownPendingCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Estimado</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(totals.estimatedGapCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">
            {isReceive ? 'Falta receber' : 'Falta pagar'}
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
            {formatBrlFromCents(totals.remainingCents)}
          </p>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle className="text-lg">{isReceive ? 'A receber' : 'A pagar agora'}</CardTitle>
          <CardDescription>
            {isReceive
              ? 'Confirme cada recebimento na conta certa'
              : hasInvoices
                ? 'Faturas de cartão (itens agrupados) e contas/boletos avulsos'
                : 'Contas, boletos e parcelas — escolha a forma de pagamento'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-0 p-0">
          {pendingEmpty ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {isReceive ? 'Nada a receber neste filtro.' : 'Nada a pagar neste filtro.'}
            </p>
          ) : null}

          {hasInvoices ? (
            <section className="space-y-4 border-b py-5">
              <SectionLabel
                icon={CreditCard}
                title="Faturas de cartão"
                description="Compras no crédito aparecem aqui agrupadas — quite o total com a conta"
              />
              <div className="px-5">
                <InvoicePayableGroups
                  today={today}
                  paymentMethods={lookups.paymentMethods}
                  centers={lookups.centers}
                  categories={lookups.expenseCategories}
                  invoices={invoices}
                />
              </div>
            </section>
          ) : null}

          {hasBills || (!isReceive && !hasInvoices && !pendingEmpty) ? (
            <section className={cn('space-y-4 py-5', hasInvoices && 'bg-muted/20')}>
              <SectionLabel
                icon={isReceive ? Wallet : ListChecks}
                title={isReceive ? 'Receitas pendentes' : 'Contas e boletos'}
                description={
                  isReceive
                    ? 'Salários, reembolsos e outras entradas a confirmar'
                    : hasInvoices
                      ? 'Luz, internet, parcelas e o restante — ainda não foram para o cartão'
                      : 'Fixas, variáveis e parcelas de financiamento'
                }
              />
              <div className="px-0 sm:px-5">
                <PaymentsTable
                  mode={isReceive ? 'receive' : 'pay'}
                  today={today}
                  accounts={lookups.tableAccounts}
                  paymentMethods={lookups.paymentMethods}
                  centers={lookups.centers}
                  categories={isReceive ? lookups.incomeCategories : lookups.expenseCategories}
                  rows={billRows.map((row) => ({
                    id: row.id,
                    dueOn: row.dueOn,
                    description: row.description,
                    kind: row.kind,
                    costCenterId: row.costCenterId,
                    costCenterName: row.costCenterName,
                    categoryId: row.categoryId,
                    categoryName: row.categoryName,
                    accountId: row.accountId,
                    amountCents: row.amountCents,
                    paymentRail: row.paymentRail,
                    paymentMethodId: row.paymentMethodId ?? null,
                    suggestedCents: row.suggestedCents,
                    estimatedCents: row.estimatedCents,
                    creditCardId: row.creditCardId,
                    creditCardInvoiceId: row.creditCardInvoiceId,
                    creditCardName: row.creditCardName,
                    purchaseCount: row.purchaseCount,
                  }))}
                />
              </div>
            </section>
          ) : null}

          {!isReceive && hasInvoices && !hasBills ? (
            <p className="border-t px-5 py-4 text-center text-xs text-muted-foreground">
              Sem contas avulsas neste filtro — só fatura(s) de cartão acima.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="gap-4 py-5 shadow-sm">
        <CardHeader className="px-5 pb-0">
          <CardTitle className="text-base">
            {isReceive ? 'Já recebidas' : 'Já liquidadas'}
          </CardTitle>
          <CardDescription>
            {isReceive
              ? `Confirmadas em ${range.label}`
              : `Pagas pela conta ou quitação de fatura · ${range.label}`}
            {settledRows.length > 0 ? ` · ${formatBrlFromCents(totals.paidTotalCents)}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <SettledPaymentsTable
            mode={isReceive ? 'receive' : 'pay'}
            today={today}
            paymentMethods={lookups.paymentMethods}
            centers={lookups.centers}
            categories={isReceive ? lookups.incomeCategories : lookups.expenseCategories}
            rows={settledRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function PaymentsPageClient(): React.ReactElement {
  const params = useSearchParamsRecord();
  useEnsurePaymentInstances(params);
  const query = useQuery({
    queryKey: queryKeys.payments(params),
    queryFn: () => api.payments.list(params),
  });

  return (
    <QueryBoundary query={query} skeleton={<TablePageSkeleton />}>
      {(data) => <PaymentsContent data={data} />}
    </QueryBoundary>
  );
}
