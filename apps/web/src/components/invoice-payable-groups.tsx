'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { CreditCard, Pencil } from 'lucide-react';
import { formatBrlFromCents, formatIsoDateBr, type PayableKind } from '@tim/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PayableRowDialog } from '@/components/payable-row-dialog';
import type { PayableRow, PaymentMethodOption } from '@/components/payment-method-options';

export interface InvoicePurchaseItem {
  id: string;
  description: string | null;
  kind: PayableKind;
  costCenterId: string | null;
  costCenterName: string;
  categoryId: string | null;
  categoryName: string;
  accountId: string;
  paymentRail: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null;
  creditCardId: string | null;
  creditCardInvoiceId: string | null;
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

function toInvoicePayableRow(invoice: InvoicePayableRow): PayableRow {
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

function toPurchasePayableRow(
  purchase: InvoicePurchaseItem,
  invoice: InvoicePayableRow,
): PayableRow {
  return {
    id: purchase.id,
    dueOn: purchase.occurredOn ?? invoice.dueOn,
    description: purchase.description,
    kind: purchase.kind,
    costCenterId: purchase.costCenterId,
    costCenterName: purchase.costCenterName,
    categoryId: purchase.categoryId,
    categoryName: purchase.categoryName,
    accountId: purchase.accountId,
    amountCents: purchase.amountCents,
    paymentRail: purchase.paymentRail,
    suggestedCents: purchase.amountCents,
    estimatedCents: purchase.amountCents,
    creditCardId: purchase.creditCardId ?? invoice.creditCardId,
    creditCardInvoiceId: purchase.creditCardInvoiceId ?? invoice.id,
    creditCardName: invoice.creditCardName,
    purchaseCount: null,
  };
}

function InvoiceGroupCard({
  invoice,
  today,
  paymentMethods,
  centers,
  categories,
  onPaid,
}: {
  invoice: InvoicePayableRow;
  today: string;
  paymentMethods: PaymentMethodOption[];
  centers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  onPaid: (id: string) => void;
}): React.ReactElement {
  const [payOpen, setPayOpen] = useState(false);
  const [editPurchaseId, setEditPurchaseId] = useState<string | null>(null);
  const overdue = (invoice.dueOn ?? '') < today;
  const items = invoice.purchases;
  const purchaseCount = items.length;
  const editPurchase = editPurchaseId
    ? (items.find((item) => item.id === editPurchaseId) ?? null)
    : null;

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
            Saldo em aberto da fatura
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-muted/20">
            {items.map((purchase) => {
              const canEdit = Boolean(purchase.categoryId && purchase.creditCardInvoiceId);
              return (
                <li
                  key={purchase.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
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
                  <div className="flex shrink-0 items-center gap-1.5">
                    <p className="text-sm font-medium tabular-nums">
                      {formatBrlFromCents(purchase.amountCents)}
                    </p>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        aria-label="Editar item"
                        onClick={() => setEditPurchaseId(purchase.id)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PayableRowDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        intent="pay"
        row={toInvoicePayableRow(invoice)}
        mode="pay"
        today={today}
        paymentMethods={paymentMethods}
        centers={[]}
        categories={[]}
        onSettled={onPaid}
      />

      {editPurchase ? (
        <PayableRowDialog
          open
          onOpenChange={(next) => {
            if (!next) setEditPurchaseId(null);
          }}
          intent="edit"
          row={toPurchasePayableRow(editPurchase, invoice)}
          mode="pay"
          today={today}
          paymentMethods={paymentMethods}
          centers={centers}
          categories={categories}
          allowPay={false}
        />
      ) : null}
    </article>
  );
}

/** Faturas de cartão: itens editáveis + quitação via modal no total. */
export function InvoicePayableGroups({
  invoices,
  today,
  paymentMethods,
  centers = [],
  categories = [],
}: {
  invoices: InvoicePayableRow[];
  today: string;
  paymentMethods: PaymentMethodOption[];
  centers?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
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
          centers={centers}
          categories={categories}
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
