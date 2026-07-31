'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import {
  formatBrlFromCents,
  formatCentsForBrInput,
  formatIsoDateBr,
  PAYABLE_KIND_LABEL,
  type PayableKind,
} from '@tim/domain';
import { MobileDataCard, MobileDataEmpty, MobileDataList } from '@/components/mobile-data-list';
import { nativeSelectClassName } from '@/components/page-header';
import {
  defaultPaymentMethodId,
  receiveAccountSelectLabel,
  uniqueAccountMethods,
  type PaymentMethodOption,
} from '@/components/payment-method-options';
import { PaymentMethodSelectGroups } from '@/components/payment-method-select-groups';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMutationFeedback } from '@/hooks/use-mutation-feedback';
import { updateTransactionAction } from '@/lib/api/mutations';

export interface SettledPaymentRow {
  id: string;
  dueOn: string | null;
  paidOn: string | null;
  description: string | null;
  kind: PayableKind;
  costCenterId: string;
  costCenterName: string;
  categoryId: string;
  categoryName: string;
  accountId: string;
  accountName: string;
  paymentRail: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null;
  paymentMethodId: string | null;
  paymentMethodLabel: string;
  amountCents: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function SettledEditDialog({
  open,
  onOpenChange,
  row,
  mode,
  today,
  paymentMethods,
  centers,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SettledPaymentRow;
  mode: 'pay' | 'receive';
  today: string;
  paymentMethods: PaymentMethodOption[];
  centers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}): React.ReactElement {
  const isReceive = mode === 'receive';
  const accountMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === 'account'),
    [paymentMethods],
  );
  const methods = useMemo(
    () => (isReceive ? uniqueAccountMethods(accountMethods) : accountMethods),
    [accountMethods, isReceive],
  );

  const [pending, startTransition] = useTransition();
  const { run } = useMutationFeedback();

  const [description, setDescription] = useState(row.description ?? '');
  const [paidOn, setPaidOn] = useState(row.paidOn ?? today);
  const [amount, setAmount] = useState(() => formatCentsForBrInput(row.amountCents));
  const [costCenterId, setCostCenterId] = useState(row.costCenterId);
  const [categoryId, setCategoryId] = useState(row.categoryId);
  const [methodId, setMethodId] = useState(() =>
    defaultPaymentMethodId(
      {
        accountId: row.accountId,
        paymentRail: row.paymentRail,
        paymentMethodId: row.paymentMethodId,
        kind: row.kind,
      },
      methods,
    ),
  );

  useEffect(() => {
    if (!open) return;
    setDescription(row.description ?? '');
    setPaidOn(row.paidOn ?? today);
    setAmount(formatCentsForBrInput(row.amountCents));
    setCostCenterId(row.costCenterId);
    setCategoryId(row.categoryId);
    setMethodId(
      defaultPaymentMethodId(
        {
          accountId: row.accountId,
          paymentRail: row.paymentRail,
          paymentMethodId: row.paymentMethodId,
          kind: row.kind,
        },
        methods,
      ),
    );
  }, [open, row, today, methods]);

  const method = methods.find((item) => item.id === methodId) ?? methods[0];

  function handleSave(): void {
    const formData = new FormData();
    formData.set('transactionId', row.id);
    formData.set('type', isReceive ? 'income' : 'expense');
    formData.set('status', 'paid');
    formData.set('description', description);
    formData.set('date', paidOn);
    formData.set('amount', amount);
    formData.set('costCenterId', costCenterId);
    formData.set('categoryId', categoryId);
    formData.set('accountId', method?.accountId ?? row.accountId);
    formData.set('paymentRail', method?.paymentRail ?? 'pix');
    formData.set('creditCardId', '');
    if (method?.id && UUID_RE.test(method.id)) {
      formData.set('paymentMethodId', method.id);
    }

    startTransition(async () => {
      try {
        await run(() => updateTransactionAction(formData), {
          loading: 'Salvando…',
          success: isReceive ? 'Recebimento atualizado' : 'Pagamento atualizado',
          invalidate: 'money',
        });
        onOpenChange(false);
      } catch {
        // toast
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isReceive ? 'Editar recebimento' : 'Editar pagamento'}</DialogTitle>
          <DialogDescription>
            {isReceive
              ? 'Ajuste data, valor, conta e classificação.'
              : 'Ajuste data, valor, forma de pagamento e classificação.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`settled-desc-${row.id}`}>Descrição</Label>
            <Input
              id={`settled-desc-${row.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Opcional"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`settled-paid-${row.id}`}>
              {isReceive ? 'Recebido em' : 'Pago em'}
            </Label>
            <DateInput
              id={`settled-paid-${row.id}`}
              value={paidOn}
              onValueChange={(iso) => setPaidOn(iso || today)}
              required
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`settled-amount-${row.id}`}>Valor (R$)</Label>
            <MoneyInput
              id={`settled-amount-${row.id}`}
              value={amount}
              onValueChange={setAmount}
              required
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`settled-center-${row.id}`}>Centro</Label>
            <select
              id={`settled-center-${row.id}`}
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
            <Label htmlFor={`settled-cat-${row.id}`}>Categoria</Label>
            <select
              id={`settled-cat-${row.id}`}
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
            <Label htmlFor={`settled-method-${row.id}`}>
              {isReceive ? 'Conta' : 'Forma de pagamento'}
            </Label>
            <select
              id={`settled-method-${row.id}`}
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
                  accountMethods={methods}
                  cardMethods={[]}
                  showCards={false}
                />
              )}
            </select>
            {!isReceive ? (
              <p className="text-xs text-muted-foreground">
                PIX, débito, TED ou boleto — agrupados por conta.
              </p>
            ) : null}
          </div>
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
          <Button type="button" disabled={pending || methods.length === 0} onClick={handleSave}>
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SettledPaymentsTable({
  rows,
  mode = 'pay',
  today,
  paymentMethods = [],
  centers = [],
  categories = [],
}: {
  rows: SettledPaymentRow[];
  mode?: 'pay' | 'receive';
  today: string;
  paymentMethods?: PaymentMethodOption[];
  centers?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
}): React.ReactElement {
  const isReceive = mode === 'receive';
  const dateLabel = isReceive ? 'Recebido em' : 'Pago em';
  const emptyLabel = isReceive
    ? 'Nenhum recebimento neste período.'
    : 'Nenhum pagamento neste período.';
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const activeRow = editRowId ? (rows.find((row) => row.id === editRowId) ?? null) : null;

  return (
    <>
      <MobileDataList
        empty={rows.length === 0 ? <MobileDataEmpty>{emptyLabel}</MobileDataEmpty> : undefined}
      >
        {rows.map((row) => (
          <MobileDataCard
            key={`m-${row.id}`}
            title={row.description?.trim() || row.categoryName}
            subtitle={row.costCenterName}
            amount={formatBrlFromCents(row.amountCents)}
            badges={<Badge variant="secondary">{PAYABLE_KIND_LABEL[row.kind]}</Badge>}
            meta={
              <>
                {row.paidOn ? `${dateLabel.toLowerCase()} ${formatIsoDateBr(row.paidOn)}` : '—'}
                {row.dueOn ? ` · venc. ${formatIsoDateBr(row.dueOn)}` : ''}
                {` · ${isReceive ? row.accountName : row.paymentMethodLabel}`}
              </>
            }
            footer={<span className="text-muted-foreground">{row.categoryName}</span>}
            actions={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                aria-label="Editar"
                onClick={() => setEditRowId(row.id)}
              >
                <Pencil className="size-3.5" />
              </Button>
            }
          />
        ))}
      </MobileDataList>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>{dateLabel}</TableHead>
              <TableHead>{isReceive ? 'Conta' : 'Forma'}</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {row.description?.trim() || row.categoryName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.costCenterName}
                        {row.dueOn ? ` · venc. ${formatIsoDateBr(row.dueOn)}` : ''}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{PAYABLE_KIND_LABEL[row.kind]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.categoryName}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {row.paidOn ? formatIsoDateBr(row.paidOn) : '—'}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                    {isReceive ? row.accountName : row.paymentMethodLabel}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBrlFromCents(row.amountCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      aria-label="Editar"
                      onClick={() => setEditRowId(row.id)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {activeRow ? (
        <SettledEditDialog
          open
          onOpenChange={(next) => {
            if (!next) setEditRowId(null);
          }}
          row={activeRow}
          mode={mode}
          today={today}
          paymentMethods={paymentMethods}
          centers={centers}
          categories={categories}
        />
      ) : null}
    </>
  );
}
