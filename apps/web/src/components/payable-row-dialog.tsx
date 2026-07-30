'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  formatBrlFromCents,
  formatCentsForBrInput,
  normalizeMoneyFormValue,
  parseBrlToCents,
} from '@tim/domain';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { nativeSelectClassName } from '@/components/page-header';
import {
  defaultPaymentMethodId,
  methodLacksBalance,
  payAmountCents,
  receiveAccountSelectLabel,
  uniqueAccountMethods,
  type PayableRow,
  type PaymentMethodOption,
} from '@/components/payment-method-options';
import { PaymentMethodSelectGroups } from '@/components/payment-method-select-groups';
import { useMutationFeedback } from '@/hooks/use-mutation-feedback';
import {
  payCreditCardInvoiceAction,
  payTransactionAction,
  updateTransactionAction,
} from '@/lib/api/mutations';
import { toast } from 'sonner';

export type PayableDialogIntent = 'pay' | 'edit';

function defaultMethodId(row: PayableRow, methods: PaymentMethodOption[]): string {
  return defaultPaymentMethodId(row, methods);
}

/**
 * Modal padrão: Pagar/Receber (intent pay) ou Editar (dados + quitar).
 * Alinha com financiamentos (ação abre dialog) e extrato (lápis = edit).
 */
export function PayableRowDialog({
  open,
  onOpenChange,
  intent,
  row,
  mode = 'pay',
  today,
  paymentMethods,
  centers,
  categories,
  onSettled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: PayableDialogIntent;
  row: PayableRow;
  mode?: 'pay' | 'receive';
  today: string;
  paymentMethods: PaymentMethodOption[];
  centers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  onSettled?: (id: string) => void;
}): React.ReactElement {
  const isReceive = mode === 'receive';
  const isInvoice = row.kind === 'credit_card_invoice';
  const showEdit = intent === 'edit' && !isInvoice;
  const actionVerb = isInvoice ? 'Quitar' : isReceive ? 'Receber' : 'Pagar';
  const actionPast = isInvoice ? 'Fatura quitada' : isReceive ? 'Recebido' : 'Pago';
  const dateLabel = isReceive ? 'Recebido em' : 'Pago em';

  const methods = useMemo((): PaymentMethodOption[] => {
    const accountOnly = paymentMethods.filter((method) => method.type === 'account');
    if (isReceive || isInvoice) return uniqueAccountMethods(accountOnly);
    return paymentMethods;
  }, [paymentMethods, isReceive, isInvoice]);

  const [pending, startTransition] = useTransition();
  const { run, beginToast } = useMutationFeedback();

  const [description, setDescription] = useState(row.description ?? '');
  const [dueOn, setDueOn] = useState(row.dueOn ?? today);
  const [editAmount, setEditAmount] = useState(() =>
    row.amountCents != null ? formatCentsForBrInput(row.amountCents) : '',
  );
  const [costCenterId, setCostCenterId] = useState(row.costCenterId ?? centers[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(row.categoryId ?? categories[0]?.id ?? '');
  const [paidOn, setPaidOn] = useState(row.dueOn ?? today);
  const [methodId, setMethodId] = useState(() => defaultMethodId(row, methods));
  const [payAmount, setPayAmount] = useState(() => {
    const cents = payAmountCents(row);
    return cents != null ? formatCentsForBrInput(cents) : '';
  });

  useEffect(() => {
    if (!open) return;
    setDescription(row.description ?? '');
    setDueOn(row.dueOn ?? today);
    setEditAmount(row.amountCents != null ? formatCentsForBrInput(row.amountCents) : '');
    setCostCenterId(row.costCenterId ?? centers[0]?.id ?? '');
    setCategoryId(row.categoryId ?? categories[0]?.id ?? '');
    setPaidOn(row.dueOn ?? today);
    setMethodId(defaultMethodId(row, methods));
    const cents = payAmountCents(row);
    setPayAmount(cents != null ? formatCentsForBrInput(cents) : '');
  }, [open, row, today, centers, categories, methods]);

  const method = methods.find((item) => item.id === methodId) ?? methods[0];
  const amountCents = parseBrlToCents(normalizeMoneyFormValue(payAmount)) ?? payAmountCents(row);
  const lacksBalance = methodLacksBalance(method, amountCents, { isReceive });
  const payWithCard = method?.type === 'credit_card';

  function buildPayFormData(): FormData {
    const formData = new FormData();
    formData.set('transactionId', row.id);
    formData.set('paidOn', paidOn);
    formData.set('amount', payAmount);
    if (isInvoice && row.creditCardId) {
      formData.set('creditCardId', row.creditCardId);
    }
    if (payWithCard && method?.creditCardId) {
      formData.set('creditCardId', method.creditCardId);
    } else {
      formData.set('accountId', method?.accountId ?? row.accountId);
      formData.set('paymentAccountId', method?.accountId ?? row.accountId);
      formData.set('paymentRail', method?.paymentRail ?? 'pix');
      formData.set('applyToBalance', 'on');
    }
    return formData;
  }

  function handleSave(): void {
    if (isInvoice) return;
    const formData = new FormData();
    formData.set('transactionId', row.id);
    formData.set('type', isReceive ? 'income' : 'expense');
    formData.set('status', 'pending');
    formData.set('description', description);
    formData.set('date', dueOn);
    formData.set('amount', editAmount);
    formData.set('costCenterId', costCenterId);
    formData.set('categoryId', categoryId);
    formData.set('accountId', method?.accountId ?? row.accountId);

    startTransition(async () => {
      try {
        await run(() => updateTransactionAction(formData), {
          loading: 'Salvando…',
          success: 'Conta atualizada',
          invalidate: 'money',
        });
        onOpenChange(false);
      } catch {
        // toast
      }
    });
  }

  function handlePay(): void {
    if (amountCents == null || amountCents <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (methodLacksBalance(method, amountCents, { isReceive })) {
      toast.error(
        `Saldo insuficiente${
          method?.balanceCents != null
            ? ` (disponível ${formatBrlFromCents(method.balanceCents)})`
            : ''
        }.`,
      );
      return;
    }

    const toastId = beginToast(
      isInvoice
        ? 'Quitando fatura…'
        : isReceive
          ? 'Registrando recebimento…'
          : 'Registrando pagamento…',
    );

    startTransition(async () => {
      try {
        if (showEdit) {
          const editForm = new FormData();
          editForm.set('transactionId', row.id);
          editForm.set('type', isReceive ? 'income' : 'expense');
          editForm.set('status', 'pending');
          editForm.set('description', description);
          editForm.set('date', dueOn);
          editForm.set('amount', editAmount || payAmount);
          editForm.set('costCenterId', costCenterId);
          editForm.set('categoryId', categoryId);
          editForm.set('accountId', method?.accountId ?? row.accountId);
          await updateTransactionAction(editForm);
        }

        await run(
          () =>
            isInvoice
              ? payCreditCardInvoiceAction(buildPayFormData())
              : payTransactionAction(buildPayFormData()),
          {
            toastId,
            success: actionPast,
            invalidate: 'money',
          },
        );
        onSettled?.(row.id);
        onOpenChange(false);
      } catch {
        // toast
      }
    });
  }

  const title =
    intent === 'edit'
      ? isReceive
        ? 'Editar receita'
        : 'Editar conta'
      : isInvoice
        ? 'Quitar fatura'
        : isReceive
          ? 'Receber'
          : 'Pagar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {intent === 'edit'
              ? `Ajuste os dados e, se quiser, ${isReceive ? 'receba' : 'pague'} por aqui.`
              : `Confirme data, ${isReceive ? 'conta' : 'forma'} e valor.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {showEdit ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor={`payable-desc-${row.id}`}>Descrição</Label>
                <Input
                  id={`payable-desc-${row.id}`}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Opcional"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`payable-due-${row.id}`}>Vencimento</Label>
                <DateInput
                  id={`payable-due-${row.id}`}
                  value={dueOn}
                  onValueChange={(iso) => setDueOn(iso || today)}
                  required
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`payable-edit-amount-${row.id}`}>Valor previsto (R$)</Label>
                <MoneyInput
                  id={`payable-edit-amount-${row.id}`}
                  value={editAmount}
                  onValueChange={setEditAmount}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`payable-center-${row.id}`}>Centro</Label>
                <select
                  id={`payable-center-${row.id}`}
                  className={nativeSelectClassName}
                  value={costCenterId}
                  onChange={(event) => setCostCenterId(event.target.value)}
                  disabled={pending || centers.length === 0}
                >
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`payable-cat-${row.id}`}>Categoria</Label>
                <select
                  id={`payable-cat-${row.id}`}
                  className={nativeSelectClassName}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  disabled={pending || categories.length === 0}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="border-t pt-3">
                <p className="mb-3 text-sm font-medium">{actionVerb}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {row.description?.trim() || row.categoryName}
              {row.amountCents != null
                ? ` · ${formatBrlFromCents(row.amountCents)}`
                : row.suggestedCents != null
                  ? ` · sugestão ${formatBrlFromCents(row.suggestedCents)}`
                  : ''}
            </p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor={`payable-paid-${row.id}`}>{dateLabel}</Label>
            <DateInput
              id={`payable-paid-${row.id}`}
              value={paidOn}
              onValueChange={(iso) => setPaidOn(iso || today)}
              required
              disabled={pending}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`payable-method-${row.id}`}>
              {isReceive ? 'Conta' : isInvoice ? 'Como quitar o cartão' : 'Forma de pagamento'}
            </Label>
            <select
              id={`payable-method-${row.id}`}
              className={nativeSelectClassName}
              value={method?.id ?? methodId}
              onChange={(event) => setMethodId(event.target.value)}
              disabled={pending || methods.length === 0}
            >
              {isReceive ? (
                methods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {receiveAccountSelectLabel(item)}
                  </option>
                ))
              ) : (
                <PaymentMethodSelectGroups
                  accountMethods={methods.filter((item) => item.type === 'account')}
                  cardMethods={methods.filter((item) => item.type === 'credit_card')}
                  showCards={!isInvoice}
                />
              )}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`payable-pay-amount-${row.id}`}>Valor (R$)</Label>
            <MoneyInput
              id={`payable-pay-amount-${row.id}`}
              value={payAmount}
              onValueChange={setPayAmount}
              required
              disabled={pending}
            />
          </div>

          {lacksBalance ? (
            <p className="text-xs text-destructive">
              Saldo insuficiente
              {method?.balanceCents != null
                ? ` (disponível ${formatBrlFromCents(method.balanceCents)})`
                : ''}
              .
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isReceive
                ? 'Credita esta conta agora.'
                : payWithCard
                  ? 'Compra no crédito → entra na fatura. A conta só é debitada ao quitar a fatura.'
                  : 'Debita a conta vinculada a esta forma agora.'}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          {showEdit ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={handleSave}>
              Salvar
            </Button>
          ) : null}
          <Button type="button" disabled={pending || lacksBalance} onClick={handlePay}>
            {pending ? `${actionVerb}…` : actionVerb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
