'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import {
  ACCOUNT_KIND_LABEL,
  accountHasSufficientBalance,
  formatBrlFromCents,
  formatCentsForBrInput,
  parseBrlToCents,
  type AccountKind,
} from '@tim/domain';
import { ArrowDownUp, ArrowLeftRight, Wallet } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SubmitButton } from '@/components/ui/submit-button';
import { createTransferAction } from '@/lib/api/mutations';
import { cn } from '@/lib/utils';

type TransferAccountOption = {
  id: string;
  name: string;
  kind: AccountKind;
  balanceCents: number;
};

const QUICK_RATIOS = [
  { label: '25%', ratio: 0.25 },
  { label: '50%', ratio: 0.5 },
  { label: '75%', ratio: 0.75 },
  { label: 'Tudo', ratio: 1 },
] as const;

function kindLabel(kind: AccountKind): string {
  return ACCOUNT_KIND_LABEL[kind] ?? kind;
}

function AccountSelectField({
  id,
  label,
  value,
  onChange,
  accounts,
  excludeId,
  tone,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (id: string) => void;
  accounts: TransferAccountOption[];
  excludeId?: string;
  tone: 'from' | 'to';
}): React.ReactElement {
  const selected = accounts.find((row) => row.id === value);

  return (
    <div
      className={cn(
        'rounded-xl border px-3.5 py-3 shadow-xs',
        tone === 'from' ? 'bg-card' : 'bg-muted/30',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <Label
          htmlFor={id}
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </Label>
        {selected ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            Disponível{' '}
            <span className="font-semibold text-foreground">
              {formatBrlFromCents(selected.balanceCents)}
            </span>
          </p>
        ) : null}
      </div>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10 w-full whitespace-normal">
          <SelectValue placeholder="Escolher conta" />
        </SelectTrigger>
        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)]">
          {accounts.map((row) => (
            <SelectItem key={row.id} value={row.id} disabled={row.id === excludeId}>
              <span className="flex w-full min-w-0 items-center justify-between gap-3">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatBrlFromCents(row.balanceCents)}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected ? (
        <p className="mt-1.5 truncate text-xs text-muted-foreground">{kindLabel(selected.kind)}</p>
      ) : null}
    </div>
  );
}

function BalancePreviewRow({
  name,
  beforeCents,
  afterCents,
  direction,
}: {
  name: string;
  beforeCents: number;
  afterCents: number;
  direction: 'out' | 'in';
}): React.ReactElement {
  const delta = afterCents - beforeCents;
  const afterNegative = afterCents < 0;
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatBrlFromCents(beforeCents)}
          <span className="mx-1.5 text-muted-foreground/50">→</span>
          <span
            className={cn(
              'font-medium',
              afterNegative
                ? 'text-destructive'
                : direction === 'in'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-foreground',
            )}
          >
            {formatBrlFromCents(afterCents)}
          </span>
        </p>
      </div>
      <p
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          direction === 'out' ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400',
        )}
      >
        {delta > 0 ? '+' : '−'}
        {formatBrlFromCents(Math.abs(delta))}
      </p>
    </div>
  );
}

export function TransferSheet({
  accounts,
  defaultFromId,
  defaultToId,
  today,
}: {
  accounts: TransferAccountOption[];
  defaultFromId: string;
  defaultToId: string;
  today: string;
}): React.ReactElement | null {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState(defaultFromId);
  const [toAccountId, setToAccountId] = useState(defaultToId);
  const [amountBr, setAmountBr] = useState('');
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setFromAccountId(defaultFromId);
    setToAccountId(defaultToId);
    setAmountBr('');
    setFormKey((key) => key + 1);
  }, [open, defaultFromId, defaultToId]);

  const fromAccount = accounts.find((row) => row.id === fromAccountId);
  const toAccount = accounts.find((row) => row.id === toAccountId);
  const amountCents = parseBrlToCents(amountBr) ?? 0;

  const sameAccount = fromAccountId === toAccountId;
  const hasAmount = amountCents > 0;
  const sufficient =
    fromAccount != null &&
    accountHasSufficientBalance({
      amountCents,
      accountBalanceCents: fromAccount.balanceCents,
    });
  const canSubmit = Boolean(fromAccount && toAccount && !sameAccount && hasAmount && sufficient);

  const preview = useMemo(() => {
    if (!fromAccount || !toAccount || !hasAmount || sameAccount) return null;
    return {
      fromAfter: fromAccount.balanceCents - amountCents,
      toAfter: toAccount.balanceCents + amountCents,
    };
  }, [fromAccount, toAccount, hasAmount, sameAccount, amountCents]);

  function swapAccounts() {
    setFromAccountId(toAccountId);
    setToAccountId(fromAccountId);
  }

  function applyQuickAmount(ratio: number) {
    if (!fromAccount || fromAccount.balanceCents <= 0) return;
    const cents = Math.floor(fromAccount.balanceCents * ratio);
    if (cents <= 0) return;
    setAmountBr(formatCentsForBrInput(cents));
  }

  if (accounts.length < 2) return null;

  let validationMessage: string | null = null;
  if (sameAccount) {
    validationMessage = 'Escolha contas de origem e destino diferentes.';
  } else if (hasAmount && !sufficient) {
    validationMessage = `Saldo insuficiente. Disponível: ${formatBrlFromCents(fromAccount?.balanceCents ?? 0)}.`;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" size="sm">
          <ArrowLeftRight className="size-3.5" />
          Transferir
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle>Transferir</SheetTitle>
          <SheetDescription>
            Move saldo entre contas e caixinhas — não conta como receita nem despesa.
          </SheetDescription>
        </SheetHeader>

        <ActionForm
          key={formKey}
          action={createTransferAction}
          successMessage="Transferência feita"
          loadingMessage="Transferindo…"
          onSuccess={() => setOpen(false)}
          className="flex flex-1 flex-col gap-5 px-5 py-5"
        >
          <input type="hidden" name="fromAccountId" value={fromAccountId} />
          <input type="hidden" name="toAccountId" value={toAccountId} />

          <div className="flex flex-col">
            <AccountSelectField
              id={`${formId}-from`}
              label="De"
              value={fromAccountId}
              onChange={setFromAccountId}
              accounts={accounts}
              excludeId={toAccountId}
              tone="from"
            />
            <div className="relative z-10 -my-3 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 rounded-full border bg-background shadow-sm"
                onClick={swapAccounts}
                aria-label="Inverter origem e destino"
              >
                <ArrowDownUp className="size-3.5" />
              </Button>
            </div>
            <AccountSelectField
              id={`${formId}-to`}
              label="Para"
              value={toAccountId}
              onChange={setToAccountId}
              accounts={accounts}
              excludeId={fromAccountId}
              tone="to"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${formId}-amount`}>Valor</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
              <MoneyInput
                id={`${formId}-amount`}
                name="amount"
                min="0.01"
                required
                value={amountBr}
                onValueChange={setAmountBr}
                placeholder="0,00"
                aria-invalid={Boolean(validationMessage && hasAmount) || undefined}
                className="h-11 pl-9 text-base"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_RATIOS.map((item) => (
                <Button
                  key={item.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  disabled={!fromAccount || fromAccount.balanceCents <= 0}
                  onClick={() => applyQuickAmount(item.ratio)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {preview && fromAccount && toAccount ? (
            <div className="rounded-xl border bg-muted/25 px-4 py-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <Wallet className="size-3.5" aria-hidden />
                Depois da transferência
              </div>
              <div className="divide-y">
                <BalancePreviewRow
                  name={fromAccount.name}
                  beforeCents={fromAccount.balanceCents}
                  afterCents={preview.fromAfter}
                  direction="out"
                />
                <BalancePreviewRow
                  name={toAccount.name}
                  beforeCents={toAccount.balanceCents}
                  afterCents={preview.toAfter}
                  direction="in"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Informe o valor para ver o saldo de cada conta depois da transferência.
            </div>
          )}

          {validationMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {validationMessage}
            </p>
          ) : null}

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-date`}>Data</Label>
              <DateInput id={`${formId}-date`} name="occurredOn" required defaultValue={today} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-description`}>Descrição (opcional)</Label>
              <Input
                id={`${formId}-description`}
                name="description"
                placeholder="Guardar na reserva"
              />
            </div>
          </div>

          <SubmitButton
            className="mt-auto w-full"
            pendingLabel="Transferindo…"
            disabled={!canSubmit}
          >
            Confirmar transferência
            {hasAmount && canSubmit ? ` · ${formatBrlFromCents(amountCents)}` : ''}
          </SubmitButton>
        </ActionForm>
      </SheetContent>
    </Sheet>
  );
}
