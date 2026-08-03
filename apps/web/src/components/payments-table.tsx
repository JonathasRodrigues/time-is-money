'use client';

import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { formatBrlFromCents, formatIsoDateBr, PAYABLE_KIND_LABEL } from '@tim/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MobileDataCard, MobileDataEmpty, MobileDataList } from '@/components/mobile-data-list';
import { PayableRowDialog, type PayableDialogIntent } from '@/components/payable-row-dialog';
import {
  defaultPaymentMethodId,
  methodLacksBalance,
  payAmountCents,
  uniqueAccountMethods,
  type PayableRow,
  type PaymentAccountOption,
  type PaymentMethodOption,
} from '@/components/payment-method-options';
import { useMutationFeedback } from '@/hooks/use-mutation-feedback';
import { payPayablesBulkAction } from '@/lib/api/mutations';
import { toast } from 'sonner';

export type {
  PayableRow,
  PaymentAccountOption,
  PaymentMethodOption,
} from '@/components/payment-method-options';

export {
  methodLacksBalance,
  paymentMethodSelectLabel,
  receiveAccountSelectLabel,
  uniqueAccountMethods,
} from '@/components/payment-method-options';

type OptimisticAction = { type: 'remove'; ids: string[] };

type DialogState = {
  rowId: string;
  intent: PayableDialogIntent;
};

/**
 * Contas a pagar/receber — linha limpa: ação principal + Editar (modal).
 * Bulk permanece na barra quando há seleção.
 */
export function PaymentsTable({
  rows,
  accounts: _accounts,
  paymentMethods,
  today,
  mode = 'pay',
  centers = [],
  categories = [],
}: {
  rows: PayableRow[];
  /** Mantido por compatibilidade; formas vêm só de `paymentMethods`. */
  accounts: PaymentAccountOption[];
  paymentMethods?: PaymentMethodOption[];
  today: string;
  mode?: 'pay' | 'receive';
  centers?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
}): React.ReactElement {
  void _accounts;
  const methods = useMemo((): PaymentMethodOption[] => {
    const fromApi = paymentMethods ?? [];
    // Só o que a API envia (já filtrado por allowedPaymentRails da conta).
    if (mode === 'receive') {
      return uniqueAccountMethods(fromApi.filter((method) => method.type === 'account'));
    }
    return fromApi;
  }, [paymentMethods, mode]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [applyAllDate, setApplyAllDate] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [, startTransition] = useTransition();
  const { run, beginToast } = useMutationFeedback();

  const [optimisticRows, dispatchOptimistic] = useOptimistic(
    rows,
    (current, action: OptimisticAction) => {
      if (action.type === 'remove') {
        const remove = new Set(action.ids);
        return current.filter((row) => !remove.has(row.id));
      }
      return current;
    },
  );

  const isReceive = mode === 'receive';
  const actionVerb = isReceive ? 'Receber' : 'Pagar';
  const actionGerund = isReceive ? 'Recebendo' : 'Pagando';
  const dateLabel = isReceive ? 'Recebido em' : 'Pago em';
  const bulkSuccess = isReceive
    ? (count: number) => (count === 1 ? 'Recebimento registrado' : 'Recebimentos registrados')
    : (count: number) => (count === 1 ? 'Pagamento registrado' : 'Pagamentos registrados');

  const busy = busyKey != null;

  const selectableIds = useMemo(
    () => optimisticRows.filter((row) => payAmountCents(row) != null).map((row) => row.id),
    [optimisticRows],
  );

  const selectedRows = useMemo(
    () => optimisticRows.filter((row) => selected.has(row.id)),
    [optimisticRows, selected],
  );

  const selectedTotalCents = useMemo(
    () => selectedRows.reduce((sum, row) => sum + (payAmountCents(row) ?? 0), 0),
    [selectedRows],
  );

  const selectedLacksBalance = useMemo(() => {
    if (isReceive) return false;
    return selectedRows.some((row) => {
      const methodId = defaultPaymentMethodId(row, methods);
      const method = methods.find((item) => item.id === methodId) ?? methods[0];
      return methodLacksBalance(method, payAmountCents(row), { isReceive });
    });
  }, [selectedRows, methods, isReceive]);

  const allSelectableChecked =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const activeRow = dialog ? (optimisticRows.find((row) => row.id === dialog.rowId) ?? null) : null;

  function toggleAll(checked: boolean): void {
    setSelected(checked ? new Set(selectableIds) : new Set());
  }

  function toggleOne(id: string, checked: boolean): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function paySelected(): void {
    type BulkPayItem = {
      kind: 'transaction' | 'credit_card_invoice';
      id: string;
      amountCents: number;
      paidOn: string;
      accountId?: string;
      creditCardId?: string;
      paymentRail?: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other';
      applyToBalance: boolean;
    };

    const paidOnOverride =
      applyAllDate && /^\d{4}-\d{2}-\d{2}$/.test(applyAllDate) ? applyAllDate : null;

    const items: BulkPayItem[] = [];
    for (const row of selectedRows) {
      const amountCents = payAmountCents(row);
      if (amountCents == null) continue;
      const paidOn = paidOnOverride ?? row.dueOn ?? today;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) continue;
      const methodId = defaultPaymentMethodId(row, methods);
      const method = methods.find((item) => item.id === methodId) ?? methods[0];

      if (methodLacksBalance(method, amountCents, { isReceive })) {
        toast.error(
          `Saldo insuficiente em ${method?.linkedAccountName ?? 'conta'} para ${formatBrlFromCents(amountCents)}.`,
        );
        return;
      }

      if (row.kind === 'credit_card_invoice') {
        if (!row.creditCardId || !method?.accountId) continue;
        items.push({
          kind: 'credit_card_invoice',
          id: row.id,
          amountCents,
          paidOn,
          creditCardId: row.creditCardId,
          accountId: method.accountId,
          paymentRail: method.paymentRail ?? 'pix',
          applyToBalance: true,
        });
        continue;
      }

      const payWithCard = method?.type === 'credit_card';
      const item: BulkPayItem = {
        kind: 'transaction',
        id: row.id,
        amountCents,
        paidOn,
        applyToBalance: !payWithCard,
      };
      if (payWithCard && method?.creditCardId) {
        item.creditCardId = method.creditCardId;
      } else if (method?.accountId) {
        item.accountId = method.accountId;
        if (method.paymentRail) item.paymentRail = method.paymentRail;
      }
      items.push(item);
    }

    if (items.length === 0) return;
    const ids = items.map((item) => item.id);
    const toastId = beginToast(`${actionGerund} ${items.length}…`);
    setBusyKey('bulk');
    setSelected(new Set());

    startTransition(async () => {
      dispatchOptimistic({ type: 'remove', ids });
      try {
        await run(() => payPayablesBulkAction({ items }), {
          toastId,
          success: bulkSuccess(items.length),
          invalidate: 'money',
        });
      } catch {
        // toast
      } finally {
        setBusyKey(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="mx-5 flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <p className="text-sm">
            <span className="font-medium">{selected.size}</span>
            <span className="text-muted-foreground">
              {' '}
              selecionada
              {selected.size === 1 ? '' : 's'} ·{' '}
            </span>
            <span className="font-semibold tabular-nums">
              {formatBrlFromCents(selectedTotalCents)}
            </span>
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="pay-apply-all" className="text-[11px] text-muted-foreground">
                Aplicar {dateLabel.toLowerCase()} em todas
              </Label>
              <DateInput
                id="pay-apply-all"
                value={applyAllDate || (selectedRows[0]?.dueOn ?? today)}
                onValueChange={setApplyAllDate}
                className="h-8 w-[9.5rem]"
                disabled={busy}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Limpar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || selectedLacksBalance}
              onClick={paySelected}
            >
              {busyKey === 'bulk' ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {actionGerund}…
                </>
              ) : (
                `${actionVerb} ${selected.size}`
              )}
            </Button>
          </div>
          {selectedLacksBalance ? (
            <p className="basis-full text-xs text-destructive">
              Uma ou mais contas selecionadas não têm saldo suficiente para o valor.
            </p>
          ) : null}
        </div>
      ) : null}

      <MobileDataList
        empty={
          optimisticRows.length === 0 ? (
            <MobileDataEmpty>
              {isReceive ? 'Nada a receber neste filtro.' : 'Nada a pagar neste filtro.'}
            </MobileDataEmpty>
          ) : undefined
        }
      >
        {optimisticRows.length > 0 ? (
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border border-input accent-primary"
                aria-label="Selecionar todas"
                checked={allSelectableChecked}
                disabled={selectableIds.length === 0 || busy}
                onChange={(event) => toggleAll(event.target.checked)}
              />
              Selecionar todas
            </label>
          </div>
        ) : null}
        {optimisticRows.map((row) => {
          const overdue = (row.dueOn ?? '') < today;
          const canSelect = payAmountCents(row) != null;
          const amount = row.amountCents;
          const methodId = defaultPaymentMethodId(row, methods);
          const method = methods.find((item) => item.id === methodId) ?? methods[0];
          const methodLabel = method
            ? isReceive
              ? method.linkedAccountName?.trim() || method.label
              : method.label
            : '—';

          return (
            <MobileDataCard
              key={`m-${row.id}`}
              selected={selected.has(row.id)}
              leading={
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input accent-primary"
                  aria-label={`Selecionar ${row.description ?? 'conta'}`}
                  checked={selected.has(row.id)}
                  disabled={!canSelect || busy}
                  title={canSelect ? undefined : 'Defina um valor antes de selecionar'}
                  onChange={(event) => toggleOne(row.id, event.target.checked)}
                />
              }
              title={row.description ?? 'Sem descrição'}
              subtitle={row.categoryName}
              amount={
                amount != null ? (
                  formatBrlFromCents(amount)
                ) : (
                  <span className="text-sm font-normal text-muted-foreground">
                    sug.{' '}
                    {row.suggestedCents != null ? formatBrlFromCents(row.suggestedCents) : 'n/d'}
                  </span>
                )
              }
              badges={
                <>
                  <Badge variant="outline">{PAYABLE_KIND_LABEL[row.kind]}</Badge>
                  {overdue ? <Badge variant="destructive">atraso</Badge> : null}
                </>
              }
              meta={
                <>
                  {row.dueOn ? `venc. ${formatIsoDateBr(row.dueOn)}` : 'sem vencimento'}
                  {row.costCenterName ? ` · ${row.costCenterName}` : ''}
                  {methodLabel !== '—' ? ` · ${methodLabel}` : ''}
                </>
              }
              actions={
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !canSelect}
                    onClick={() => setDialog({ rowId: row.id, intent: 'pay' })}
                  >
                    {actionVerb}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    aria-label="Editar"
                    disabled={busy}
                    onClick={() => setDialog({ rowId: row.id, intent: 'edit' })}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </>
              }
            />
          );
        })}
      </MobileDataList>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input accent-primary"
                  aria-label="Selecionar todas"
                  checked={allSelectableChecked}
                  disabled={selectableIds.length === 0 || busy}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Centro</TableHead>
              <TableHead>{isReceive ? 'Conta' : 'Forma'}</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {isReceive ? 'Nada a receber neste filtro.' : 'Nada a pagar neste filtro.'}
                </TableCell>
              </TableRow>
            ) : (
              optimisticRows.map((row) => {
                const overdue = (row.dueOn ?? '') < today;
                const canSelect = payAmountCents(row) != null;
                const amount = row.amountCents;
                const methodId = defaultPaymentMethodId(row, methods);
                const method = methods.find((item) => item.id === methodId) ?? methods[0];
                const methodLabel = method
                  ? isReceive
                    ? method.linkedAccountName?.trim() || method.label
                    : method.label
                  : '—';

                return (
                  <TableRow key={row.id} data-state={selected.has(row.id) ? 'selected' : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-4 rounded border border-input accent-primary"
                        aria-label={`Selecionar ${row.description ?? 'conta'}`}
                        checked={selected.has(row.id)}
                        disabled={!canSelect || busy}
                        title={canSelect ? undefined : 'Defina um valor antes de selecionar'}
                        onChange={(event) => toggleOne(row.id, event.target.checked)}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className={overdue ? 'text-destructive' : undefined}>
                        {row.dueOn ? formatIsoDateBr(row.dueOn) : '—'}
                      </span>
                      {overdue ? (
                        <Badge variant="destructive" className="ml-2">
                          atraso
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{row.description ?? 'Sem descrição'}</p>
                      <p className="text-xs text-muted-foreground">{row.categoryName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{PAYABLE_KIND_LABEL[row.kind]}</Badge>
                    </TableCell>
                    <TableCell>{row.costCenterName}</TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                      {methodLabel}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {amount != null ? (
                        formatBrlFromCents(amount)
                      ) : (
                        <span className="text-muted-foreground">
                          — · sugestão{' '}
                          {row.suggestedCents != null
                            ? formatBrlFromCents(row.suggestedCents)
                            : 'n/d'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy || !canSelect}
                          onClick={() => setDialog({ rowId: row.id, intent: 'pay' })}
                        >
                          {actionVerb}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          aria-label="Editar"
                          disabled={busy}
                          onClick={() => setDialog({ rowId: row.id, intent: 'edit' })}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {activeRow && dialog ? (
        <PayableRowDialog
          open
          onOpenChange={(next) => {
            if (!next) setDialog(null);
          }}
          intent={dialog.intent}
          row={activeRow}
          mode={mode}
          today={today}
          paymentMethods={methods}
          centers={centers}
          categories={categories}
          onSettled={(id) => {
            startTransition(() => {
              dispatchOptimistic({ type: 'remove', ids: [id] });
            });
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }}
        />
      ) : null}
    </div>
  );
}
