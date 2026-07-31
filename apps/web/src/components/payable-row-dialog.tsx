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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function persistablePaymentMethodId(id: string | undefined): string | null {
  if (!id || !UUID_RE.test(id)) return null;
  return id;
}

/**
 * Modal padrão: Pagar/Receber (intent pay) ou Editar (dados + quitar).
 * Em Contas a pagar, o seletor é sempre forma de pagamento (agrupada por conta) — nunca só conta.
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

  const accountMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === 'account'),
    [paymentMethods],
  );
  const cardMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === 'credit_card'),
    [paymentMethods],
  );

  /** Pendência / edição: só formas na conta (PIX/débito/TED/boleto), agrupadas por conta. */
  const plannedMethods = useMemo((): PaymentMethodOption[] => {
    if (isReceive) return uniqueAccountMethods(accountMethods);
    return accountMethods;
  }, [accountMethods, isReceive]);

  /** Quitação: receber = conta; fatura = formas na conta; pagar = formas + cartão. */
  const settleMethods = useMemo((): PaymentMethodOption[] => {
    if (isReceive) return uniqueAccountMethods(accountMethods);
    if (isInvoice) return accountMethods;
    return paymentMethods;
  }, [accountMethods, paymentMethods, isReceive, isInvoice]);

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
  const [plannedMethodId, setPlannedMethodId] = useState(() =>
    defaultPaymentMethodId(row, plannedMethods),
  );
  const [settleMethodId, setSettleMethodId] = useState(() =>
    defaultPaymentMethodId(row, settleMethods),
  );
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
    setPlannedMethodId(defaultPaymentMethodId(row, plannedMethods));
    setSettleMethodId(defaultPaymentMethodId(row, settleMethods));
    const cents = payAmountCents(row);
    setPayAmount(cents != null ? formatCentsForBrInput(cents) : '');
  }, [open, row, today, centers, categories, plannedMethods, settleMethods]);

  const plannedMethod =
    plannedMethods.find((item) => item.id === plannedMethodId) ?? plannedMethods[0];
  const settleMethod = settleMethods.find((item) => item.id === settleMethodId) ?? settleMethods[0];
  const amountCents = parseBrlToCents(normalizeMoneyFormValue(payAmount)) ?? payAmountCents(row);
  const lacksBalance = methodLacksBalance(settleMethod, amountCents, { isReceive });
  const payWithCard = settleMethod?.type === 'credit_card';

  function buildPayFormData(): FormData {
    const formData = new FormData();
    formData.set('transactionId', row.id);
    formData.set('paidOn', paidOn);
    formData.set('amount', payAmount);
    if (isInvoice && row.creditCardId) {
      formData.set('creditCardId', row.creditCardId);
    }
    if (payWithCard && settleMethod?.creditCardId) {
      formData.set('creditCardId', settleMethod.creditCardId);
    } else {
      formData.set('accountId', settleMethod?.accountId ?? row.accountId);
      formData.set('paymentAccountId', settleMethod?.accountId ?? row.accountId);
      formData.set('paymentRail', settleMethod?.paymentRail ?? 'pix');
      formData.set('applyToBalance', 'on');
      const methodId = persistablePaymentMethodId(settleMethod?.id);
      if (methodId) formData.set('paymentMethodId', methodId);
    }
    return formData;
  }

  function appendPlannedPaymentMethodFields(formData: FormData): void {
    formData.set('accountId', plannedMethod?.accountId ?? row.accountId);
    formData.set('paymentRail', plannedMethod?.paymentRail ?? 'pix');
    const methodId = persistablePaymentMethodId(plannedMethod?.id);
    if (methodId) formData.set('paymentMethodId', methodId);
    formData.set('creditCardId', '');
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
    appendPlannedPaymentMethodFields(formData);

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
    if (methodLacksBalance(settleMethod, amountCents, { isReceive })) {
      toast.error(
        `Saldo insuficiente${
          settleMethod?.balanceCents != null
            ? ` (disponível ${formatBrlFromCents(settleMethod.balanceCents)})`
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
          appendPlannedPaymentMethodFields(editForm);
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
        : 'Editar conta a pagar'
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
              : `Confirme data, ${isReceive ? 'conta' : 'forma de pagamento'} e valor.`}
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
              <div className="grid gap-1.5">
                <Label htmlFor={`payable-planned-method-${row.id}`}>
                  {isReceive ? 'Conta prevista' : 'Forma de pagamento'}
                </Label>
                <select
                  id={`payable-planned-method-${row.id}`}
                  className={nativeSelectClassName}
                  value={plannedMethod?.id ?? plannedMethodId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setPlannedMethodId(nextId);
                    // Mantém quitação alinhada quando a forma planejada é na conta.
                    if (settleMethods.some((item) => item.id === nextId)) {
                      setSettleMethodId(nextId);
                    }
                  }}
                  disabled={pending || plannedMethods.length === 0}
                >
                  {isReceive ? (
                    plannedMethods.map((item) => (
                      <option key={item.id} value={item.id}>
                        {receiveAccountSelectLabel(item)}
                      </option>
                    ))
                  ) : (
                    <PaymentMethodSelectGroups
                      accountMethods={plannedMethods}
                      cardMethods={[]}
                      showCards={false}
                    />
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  {isReceive
                    ? 'Conta onde o valor deve entrar.'
                    : 'PIX, débito, TED ou boleto — agrupados por conta. Cartão só na hora de pagar.'}
                </p>
              </div>
              <div className="border-t pt-3">
                <p className="mb-3 text-sm font-medium">{actionVerb} agora</p>
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
              value={settleMethod?.id ?? settleMethodId}
              onChange={(event) => setSettleMethodId(event.target.value)}
              disabled={pending || settleMethods.length === 0}
            >
              {isReceive ? (
                settleMethods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {receiveAccountSelectLabel(item)}
                  </option>
                ))
              ) : (
                <PaymentMethodSelectGroups
                  accountMethods={accountMethods}
                  cardMethods={cardMethods}
                  showCards={!isInvoice}
                />
              )}
            </select>
            {showEdit && !isReceive ? (
              <p className="text-xs text-muted-foreground">
                Forma usada nesta quitação (pode diferir da prevista acima).
              </p>
            ) : null}
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
              {settleMethod?.balanceCents != null
                ? ` (disponível ${formatBrlFromCents(settleMethod.balanceCents)})`
                : ''}
              .
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isReceive
                ? 'Credita esta conta agora.'
                : payWithCard
                  ? 'Compra no crédito → entra na fatura. A conta só é debitada ao quitar a fatura.'
                  : 'Debita via esta forma de pagamento agora.'}
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
