'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { CreditCard, Pencil } from 'lucide-react';
import {
  formatBrlFromCents,
  formatCreditCardPaymentMethodLabel,
  formatIsoDateBr,
  PAYABLE_KIND_LABEL,
  type PayableKind,
} from '@tim/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MobileDataCard, MobileDataEmpty, MobileDataList } from '@/components/mobile-data-list';
import { PayableRowDialog } from '@/components/payable-row-dialog';
import type { PayableRow, PaymentMethodOption } from '@/components/payment-method-options';
import { cn } from '@/lib/utils';

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

function creditFormLabel(invoice: InvoicePayableRow): string {
  return formatCreditCardPaymentMethodLabel({
    cardName: invoice.creditCardName?.trim() || 'Cartão',
    lastFour: null,
    institutionName: null,
  });
}

function InvoiceGroup({
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
  const formLabel = creditFormLabel(invoice);
  const editPurchase = editPurchaseId
    ? (items.find((item) => item.id === editPurchaseId) ?? null)
    : null;

  return (
    <section className="space-y-0">
      <header
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5',
          overdue ? 'bg-destructive/5' : 'bg-muted/30',
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400">
            <CreditCard className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold tracking-tight">
                {invoice.creditCardName
                  ? `Fatura · ${invoice.creditCardName}`
                  : (invoice.description ?? 'Fatura de cartão')}
              </p>
              {overdue ? <Badge variant="destructive">Em atraso</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {[
                invoice.dueOn ? `Vence ${formatIsoDateBr(invoice.dueOn)}` : null,
                purchaseCount > 0
                  ? `${purchaseCount} ${purchaseCount === 1 ? 'item' : 'itens'}`
                  : 'Saldo em aberto',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-base font-semibold tabular-nums">
            {formatBrlFromCents(invoice.amountCents)}
          </p>
          <Button type="button" size="sm" onClick={() => setPayOpen(true)}>
            Quitar fatura
          </Button>
        </div>
      </header>

      <MobileDataList
        empty={
          purchaseCount === 0 ? (
            <MobileDataEmpty>Nenhum item detalhado nesta fatura.</MobileDataEmpty>
          ) : undefined
        }
      >
        {items.map((purchase) => {
          const date = purchase.occurredOn ?? invoice.dueOn;
          const dateOverdue = (date ?? '') < today;
          const canEdit = Boolean(purchase.categoryId && purchase.creditCardInvoiceId);
          return (
            <MobileDataCard
              key={`m-${purchase.id}`}
              title={purchase.description?.trim() || purchase.categoryName}
              subtitle={purchase.categoryName}
              amount={formatBrlFromCents(purchase.amountCents)}
              badges={
                <>
                  <Badge variant="outline">{PAYABLE_KIND_LABEL[purchase.kind]}</Badge>
                  {dateOverdue ? <Badge variant="destructive">atraso</Badge> : null}
                </>
              }
              meta={
                <>
                  {date ? `venc. ${formatIsoDateBr(date)}` : 'sem data'}
                  {purchase.costCenterName ? ` · ${purchase.costCenterName}` : ''}
                  {` · ${formLabel}`}
                </>
              }
              actions={
                canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    aria-label="Editar"
                    onClick={() => setEditPurchaseId(purchase.id)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                ) : null
              }
            />
          );
        })}
      </MobileDataList>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Centro</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseCount === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                  Nenhum item detalhado nesta fatura.
                </TableCell>
              </TableRow>
            ) : (
              items.map((purchase) => {
                const date = purchase.occurredOn ?? invoice.dueOn;
                const dateOverdue = (date ?? '') < today;
                const canEdit = Boolean(purchase.categoryId && purchase.creditCardInvoiceId);
                return (
                  <TableRow key={purchase.id}>
                    <TableCell className="tabular-nums">
                      <span className={dateOverdue ? 'text-destructive' : undefined}>
                        {date ? formatIsoDateBr(date) : '—'}
                      </span>
                      {dateOverdue ? (
                        <Badge variant="destructive" className="ml-2">
                          atraso
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {purchase.description?.trim() || purchase.categoryName}
                      </p>
                      <p className="text-xs text-muted-foreground">{purchase.categoryName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{PAYABLE_KIND_LABEL[purchase.kind]}</Badge>
                    </TableCell>
                    <TableCell>{purchase.costCenterName}</TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                      {formLabel}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBrlFromCents(purchase.amountCents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            aria-label="Editar"
                            onClick={() => setEditPurchaseId(purchase.id)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
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
    </section>
  );
}

/** Faturas de cartão: linhas estilo tabela + quitação no cabeçalho do grupo. */
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
    <div className="divide-y">
      {optimistic.map((invoice) => (
        <InvoiceGroup
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
