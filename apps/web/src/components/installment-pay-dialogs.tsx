'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  formatBrlFromCents,
  formatCentsForBrInput,
  formatIsoDateBr,
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
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { runWithToast } from '@/lib/action-toast';
import { payInstallmentAction, payInstallmentsBulkAction } from '@/server/actions';

export interface FinancingInstallmentRow {
  id: string;
  number: number;
  dueOn: string;
  status: string;
  amountCents: number;
  interestCents: number;
  principalCents: number;
  paidOn: string | null;
}

function CategorySelect({
  id,
  categories,
}: {
  id: string;
  categories: Array<{ id: string; name: string }>;
}): React.ReactElement {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Categoria</Label>
      <select
        id={id}
        name="categoryId"
        required
        defaultValue={categories[0]?.id}
        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Confirma pagamento de uma ou várias parcelas, com valor e data editáveis. */
export function PayInstallmentsDialog({
  open,
  onOpenChange,
  installments,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installments: FinancingInstallmentRow[];
  categories: Array<{ id: string; name: string }>;
}): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [paidOns, setPaidOns] = useState<Record<string, string>>({});
  const [applyAllDate, setApplyAllDate] = useState('');

  useEffect(() => {
    if (!open) return;
    const nextAmounts: Record<string, string> = {};
    const nextPaidOns: Record<string, string> = {};
    for (const item of installments) {
      nextAmounts[item.id] = formatCentsForBrInput(item.amountCents);
      nextPaidOns[item.id] = item.dueOn;
    }
    setAmounts(nextAmounts);
    setPaidOns(nextPaidOns);
    setApplyAllDate(installments[0]?.dueOn ?? '');
  }, [open, installments]);

  const totalCents = useMemo(() => {
    let sum = 0;
    for (const item of installments) {
      const cents = parseBrlToCents(amounts[item.id] ?? '');
      if (cents == null || cents <= 0) return null;
      sum += cents;
    }
    return sum;
  }, [amounts, installments]);

  const single = installments.length === 1 ? installments[0] : null;
  const showApplyAll = installments.length > 1;

  function applyDateToAll() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applyAllDate)) return;
    setPaidOns((prev) => {
      const next = { ...prev };
      for (const item of installments) {
        next[item.id] = applyAllDate;
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {single ? `Pagar parcela #${single.number}` : `Pagar ${installments.length} parcelas`}
          </DialogTitle>
          <DialogDescription>
            A data padrão de cada parcela é o vencimento. Ajuste valor ou data se precisar.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            startTransition(async () => {
              try {
                await runWithToast(
                  () =>
                    installments.length === 1
                      ? payInstallmentAction(formData)
                      : payInstallmentsBulkAction(formData),
                  {
                    loading: 'Registrando pagamento…',
                    success: installments.length === 1 ? 'Parcela paga' : 'Parcelas pagas',
                  },
                );
                onOpenChange(false);
              } catch {
                // toast já exibido
              }
            });
          }}
          className="grid gap-4"
        >
          {showApplyAll ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
              <Label htmlFor="pay-apply-all" className="text-xs text-muted-foreground">
                Aplicar uma data em todas
              </Label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <DateInput
                  id="pay-apply-all"
                  value={applyAllDate}
                  onValueChange={setApplyAllDate}
                  className="h-9 flex-1 min-w-[10rem]"
                />
                <Button type="button" size="sm" variant="outline" onClick={applyDateToAll}>
                  Aplicar
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {installments.map((item) => (
              <div key={item.id} className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                <input type="hidden" name="installmentId" value={item.id} />
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium">
                    #{item.number} · vence {formatIsoDateBr(item.dueOn)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    cronograma {formatBrlFromCents(item.amountCents)}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`pay-amount-${item.id}`}>Valor pago (R$)</Label>
                    <MoneyInput
                      id={`pay-amount-${item.id}`}
                      name="amount"
                      min="0.01"
                      required
                      value={amounts[item.id] ?? ''}
                      onValueChange={(value) => {
                        setAmounts((prev) => ({ ...prev, [item.id]: value }));
                      }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`pay-on-${item.id}`}>Pago em</Label>
                    <DateInput
                      id={`pay-on-${item.id}`}
                      name="paidOn"
                      required
                      value={paidOns[item.id] ?? item.dueOn}
                      onValueChange={(value) => {
                        setPaidOns((prev) => ({ ...prev, [item.id]: value }));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span className="font-medium">Total</span>
            <span className="font-semibold tabular-nums">
              {totalCents != null ? formatBrlFromCents(totalCents) : '—'}
            </span>
          </div>

          <CategorySelect id="pay-cat-bulk" categories={categories} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <SubmitButton
              disabled={pending || totalCents == null}
              isPending={pending}
              pendingLabel="Pagando…"
            >
              Confirmar pagamento
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Amortiza o principal de uma ou mais parcelas futuras junto com a parcela do mês. */
export function AmortizeSelectedDialog({
  open,
  onOpenChange,
  currentMonth,
  futures,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: FinancingInstallmentRow;
  futures: FinancingInstallmentRow[];
  categories: Array<{ id: string; name: string }>;
}): React.ReactElement {
  const suggestedPrincipalCents = futures.reduce((acc, future) => {
    const principal =
      future.principalCents > 0
        ? future.principalCents
        : Math.max(0, future.amountCents - future.interestCents);
    return acc + principal;
  }, 0);

  const [amountDraft, setAmountDraft] = useState(formatCentsForBrInput(currentMonth.amountCents));
  const [extraDraft, setExtraDraft] = useState(formatCentsForBrInput(suggestedPrincipalCents));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setAmountDraft(formatCentsForBrInput(currentMonth.amountCents));
    setExtraDraft(formatCentsForBrInput(suggestedPrincipalCents));
  }, [open, currentMonth.amountCents, suggestedPrincipalCents]);

  const amountCents = useMemo(() => {
    const cents = parseBrlToCents(amountDraft);
    return cents != null && cents > 0 ? cents : null;
  }, [amountDraft]);
  const extraCents = useMemo(() => {
    const cents = parseBrlToCents(extraDraft);
    return cents != null && cents > 0 ? cents : null;
  }, [extraDraft]);
  const totalCents = amountCents != null && extraCents != null ? amountCents + extraCents : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Amortizar {futures.length} parcela{futures.length === 1 ? '' : 's'}
          </DialogTitle>
          <DialogDescription>
            Paga a parcela do mês (valor editável) e antecipa o principal das selecionadas — os
            juros futuros não entram.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            startTransition(async () => {
              try {
                await runWithToast(() => payInstallmentAction(formData), {
                  loading: 'Confirmando amortização…',
                  success: 'Amortização registrada',
                });
                onOpenChange(false);
              } catch {
                // toast já exibido
              }
            });
          }}
          className="grid gap-4"
        >
          <input type="hidden" name="installmentId" value={currentMonth.id} />

          <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Parcelas futuras
            </p>
            {futures.map((future) => {
              const principal =
                future.principalCents > 0
                  ? future.principalCents
                  : Math.max(0, future.amountCents - future.interestCents);
              return (
                <div key={future.id} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    #{future.number} · {formatIsoDateBr(future.dueOn)}
                  </span>
                  <span className="tabular-nums">{formatBrlFromCents(principal)}</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 border-t pt-2">
              <span className="font-medium">Principal sugerido</span>
              <span className="font-medium tabular-nums">
                {formatBrlFromCents(suggestedPrincipalCents)}
              </span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`pay-month-${currentMonth.id}`}>
              Parcela #{currentMonth.number} (R$)
            </Label>
            <MoneyInput
              id={`pay-month-${currentMonth.id}`}
              name="amount"
              min="0.01"
              required
              value={amountDraft}
              onValueChange={setAmountDraft}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`extra-bulk-${currentMonth.id}`}>Amortização antecipada (R$)</Label>
            <MoneyInput
              id={`extra-bulk-${currentMonth.id}`}
              name="extraAmortization"
              min="0.01"
              required
              value={extraDraft}
              onValueChange={setExtraDraft}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span className="font-medium">Total neste mês</span>
            <span className="font-semibold tabular-nums">
              {totalCents != null ? formatBrlFromCents(totalCents) : '—'}
            </span>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`amort-on-${currentMonth.id}`}>Pagar em</Label>
            <DateInput
              id={`amort-on-${currentMonth.id}`}
              name="paidOn"
              required
              defaultValue={currentMonth.dueOn}
            />
          </div>

          <CategorySelect id={`amort-cat-${currentMonth.id}`} categories={categories} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <SubmitButton
              disabled={pending || totalCents == null}
              isPending={pending}
              pendingLabel="Confirmando…"
            >
              Confirmar neste mês
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
