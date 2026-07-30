'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { CreditCard } from 'lucide-react';
import { formatBrlFromCents, formatIsoDateBr } from '@tim/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PayableRowDialog } from '@/components/payable-row-dialog';
import type { PayableRow, PaymentMethodOption } from '@/components/payment-method-options';

export interface InvoicePurchaseItem {
  id: string;
  description: string | null;
  categoryName: string;
  occurredOn: string | null;
  amountCents: number;
}

export interface InvoicePayableRow {
  id: string;
  dueOn: string | null;
  description: string | null;
  accountId: string;
  amountCents: number;
  creditCardId: string;
  creditCardName: string | null;
  purchases: InvoicePurchaseItem[];
}

function toPayableRow(invoice: InvoicePayableRow): PayableRow {
  return {
    id: invoice.id,
    dueOn: invoice.dueOn,
    description: invoice.description,
    kind: 'credit_card_invoice',
    costCenterId: null,
    costCenterName: '—',
    categoryId: null,
    categoryName: 'Fatura de cartão',
    accountId: invoice.accountId,
    amountCents: invoice.amountCents,
    paymentRail: null,
    suggestedCents: invoice.amountCents,
    estimatedCents: invoice.amountCents,
    creditCardId: invoice.creditCardId,
    creditCardInvoiceId: invoice.id,
    creditCardName: invoice.creditCardName,
    purchaseCount: invoice.purchases.length,
  };
}

function InvoiceGroupCard({
  invoice,
  today,
  paymentMethods,
  onPaid,
}: {
  invoice: InvoicePayableRow;
  today: string;
  paymentMethods: PaymentMethodOption[];
  onPaid: (id: string) => void;
}): React.ReactElement {
  const [payOpen, setPayOpen] = useState(false);
  const overdue = (invoice.dueOn ?? '') < today;
  const purchaseCount = invoice.purchases.length;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-sm',
        overdue ? 'border-destructive/35' : 'border-border',
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400">
              <CreditCard className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-tight">
                {invoice.creditCardName
                  ? `Fatura · ${invoice.creditCardName}`
                  : (invoice.description ?? 'Fatura de cartão')}
              </p>
              <p className="text-xs text-muted-foreground">
                {[
                  invoice.dueOn ? `Vence ${formatIsoDateBr(invoice.dueOn)}` : null,
                  purchaseCount > 0
                    ? `${purchaseCount} ${purchaseCount === 1 ? 'item' : 'itens'} no crédito`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {overdue ? <Badge variant="destructive">Em atraso</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Total a quitar
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {formatBrlFromCents(invoice.amountCents)}
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setPayOpen(true)}>
            Quitar fatura
          </Button>
        </div>
      </header>

      <div className="px-4 py-3 sm:px-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Itens nesta fatura</p>
        {purchaseCount === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Saldo em aberto sem detalhe de compras (cadastro legado).
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-muted/20">
            {invoice.purchases.map((purchase) => (
              <li
                key={purchase.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {purchase.description?.trim() || purchase.categoryName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      purchase.categoryName,
                      purchase.occurredOn ? formatIsoDateBr(purchase.occurredOn) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium tabular-nums">
                  {formatBrlFromCents(purchase.amountCents)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PayableRowDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        intent="pay"
        row={toPayableRow(invoice)}
        mode="pay"
        today={today}
        paymentMethods={paymentMethods}
        centers={[]}
        categories={[]}
        onSettled={onPaid}
      />
    </article>
  );
}

/** Faturas de cartão: itens visíveis + quitação via modal (ação principal). */
export function InvoicePayableGroups({
  invoices,
  today,
  paymentMethods,
}: {
  invoices: InvoicePayableRow[];
  today: string;
  paymentMethods: PaymentMethodOption[];
}): React.ReactElement | null {
  const [, startTransition] = useTransition();
  const [optimistic, removeOptimistic] = useOptimistic(invoices, (current, removedId: string) =>
    current.filter((invoice) => invoice.id !== removedId),
  );

  if (optimistic.length === 0) return null;

  return (
    <div className="space-y-3">
      {optimistic.map((invoice) => (
        <InvoiceGroupCard
          key={invoice.id}
          invoice={invoice}
          today={today}
          paymentMethods={paymentMethods}
          onPaid={(id) => {
            startTransition(() => {
              removeOptimistic(id);
            });
          }}
        />
      ))}
    </div>
  );
}
