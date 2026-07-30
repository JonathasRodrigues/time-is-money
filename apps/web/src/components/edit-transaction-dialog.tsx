'use client';

import { useMemo, useState } from 'react';
import { formatCentsForBrInput } from '@tim/domain';
import { Loader2, Pencil } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { FormBusySurface } from '@/components/form-busy-surface';
import { nativeSelectClassName } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useBusyAction } from '@/hooks/use-busy-action';
import { useMutationFeedback } from '@/hooks/use-mutation-feedback';
import { deleteTransactionAction, updateTransactionAction } from '@/lib/api/mutations';

interface Option {
  id: string;
  name: string;
}

interface CategoryOption extends Option {
  type: string;
}

export function EditTransactionDialog({
  transaction,
  centers,
  categories,
  accounts,
}: {
  transaction: {
    id: string;
    type: 'income' | 'expense';
    status: 'pending' | 'paid';
    amountCents: number | null;
    occurredOn: string;
    dueOn: string | null;
    paidOn: string | null;
    description: string | null;
    costCenterId: string;
    categoryId: string;
    accountId: string;
    installmentId: string | null;
  };
  centers: Option[];
  categories: CategoryOption[];
  accounts: Option[];
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>(transaction.type);
  const [status, setStatus] = useState<'pending' | 'paid'>(transaction.status);
  const { busy, isBusy, run: runBusy } = useBusyAction<'delete'>();
  const { run } = useMutationFeedback();
  const pendingDelete = isBusy('delete');

  const defaultDate =
    transaction.status === 'paid'
      ? (transaction.paidOn ?? transaction.occurredOn)
      : (transaction.dueOn ?? transaction.occurredOn);

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  const isExpense = type === 'expense';
  const isPaid = status === 'paid';
  const dateLabel = isPaid
    ? isExpense
      ? 'Data do pagamento'
      : 'Data do recebimento'
    : 'Data de vencimento';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setType(transaction.type);
          setStatus(transaction.status);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" aria-label="Editar">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>
            Corrija data, valor, status ou classificação.
            {transaction.installmentId
              ? ' Este movimento está ligado a uma parcela de financiamento.'
              : null}
          </DialogDescription>
        </DialogHeader>

        <ActionForm
          action={updateTransactionAction}
          successMessage="Lançamento atualizado"
          loadingMessage="Salvando…"
          invalidate="money"
          onSuccess={() => setOpen(false)}
        >
          <FormBusySurface className="grid gap-3">
            <input type="hidden" name="transactionId" value={transaction.id} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="status" value={status} />

            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                spacing={0}
                value={type}
                onValueChange={(value) => {
                  if (value === 'expense' || value === 'income') setType(value);
                }}
                className="w-full bg-muted/40"
              >
                <ToggleGroupItem value="expense" className="flex-1">
                  Despesa
                </ToggleGroupItem>
                <ToggleGroupItem value="income" className="flex-1">
                  Receita
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="grid gap-1.5">
              <Label>Status</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                spacing={0}
                value={status}
                onValueChange={(value) => {
                  if (value === 'pending' || value === 'paid') setStatus(value);
                }}
                className="w-full bg-muted/40"
              >
                <ToggleGroupItem value="paid" className="flex-1">
                  {isExpense ? 'Pago' : 'Recebido'}
                </ToggleGroupItem>
                <ToggleGroupItem value="pending" className="flex-1">
                  {isExpense ? 'Contas a pagar' : 'Contas a receber'}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`edit-tx-desc-${transaction.id}`}>Descrição</Label>
              <Input
                id={`edit-tx-desc-${transaction.id}`}
                name="description"
                defaultValue={transaction.description ?? ''}
                placeholder="Opcional"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`edit-tx-date-${transaction.id}`}>{dateLabel}</Label>
              <DateInput
                id={`edit-tx-date-${transaction.id}`}
                name="date"
                required
                defaultValue={defaultDate}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`edit-tx-amount-${transaction.id}`}>
                Valor (R$){isPaid ? '' : ' — opcional'}
              </Label>
              <MoneyInput
                id={`edit-tx-amount-${transaction.id}`}
                name="amount"
                required={isPaid}
                defaultValue={
                  transaction.amountCents != null
                    ? formatCentsForBrInput(transaction.amountCents)
                    : ''
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`edit-tx-center-${transaction.id}`}>Centro</Label>
              <select
                id={`edit-tx-center-${transaction.id}`}
                name="costCenterId"
                required
                className={nativeSelectClassName}
                defaultValue={transaction.costCenterId}
              >
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`edit-tx-cat-${transaction.id}`}>Categoria</Label>
              <select
                id={`edit-tx-cat-${transaction.id}`}
                name="categoryId"
                required
                className={nativeSelectClassName}
                defaultValue={
                  filteredCategories.some((c) => c.id === transaction.categoryId)
                    ? transaction.categoryId
                    : filteredCategories[0]?.id
                }
                key={`${type}-${filteredCategories.map((c) => c.id).join(',')}`}
              >
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`edit-tx-acc-${transaction.id}`}>Conta</Label>
              <select
                id={`edit-tx-acc-${transaction.id}`}
                name="accountId"
                required
                className={nativeSelectClassName}
                defaultValue={transaction.accountId}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                disabled={pendingDelete}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Excluir este lançamento? Ele some do extrato e das contas a pagar/receber.',
                    )
                  ) {
                    return;
                  }
                  const formData = new FormData();
                  formData.set('transactionId', transaction.id);
                  void runBusy('delete', async () => {
                    try {
                      await run(() => deleteTransactionAction(formData), {
                        loading: 'Excluindo…',
                        success: 'Lançamento excluído',
                        invalidate: 'money',
                      });
                      setOpen(false);
                    } catch {
                      // toast já exibido
                    }
                  });
                }}
              >
                {pendingDelete ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Excluindo…
                  </>
                ) : (
                  'Excluir'
                )}
              </Button>
              <SubmitButton pendingLabel="Salvando…" disabled={busy}>
                Salvar
              </SubmitButton>
            </div>
          </FormBusySurface>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
