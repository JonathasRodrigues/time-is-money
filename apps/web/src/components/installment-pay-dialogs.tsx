'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { formatBrlFromCents, formatIsoDateBr } from '@tim/domain';
import { Button } from '@/components/ui/button';
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

function parseAmountToCents(raw: string): number | null {
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
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
      nextAmounts[item.id] = (item.amountCents / 100).toFixed(2);
      nextPaidOns[item.id] = item.dueOn;
    }
    setAmounts(nextAmounts);
    setPaidOns(nextPaidOns);
    setApplyAllDate(installments[0]?.dueOn ?? '');
  }, [open, installments]);

  const totalCents = useMemo(() => {
    let sum = 0;
    for (const item of installments) {
      const cents = parseAmountToCents(amounts[item.id] ?? '');
      if (cents == null) return null;
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
                <Input
                  id="pay-apply-all"
                  type="date"
                  value={applyAllDate}
                  onChange={(event) => setApplyAllDate(event.target.value)}
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
                    <Input
                      id={`pay-amount-${item.id}`}
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amounts[item.id] ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAmounts((prev) => ({ ...prev, [item.id]: value }));
                      }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`pay-on-${item.id}`}>Pago em</Label>
                    <Input
                      id={`pay-on-${item.id}`}
                      name="paidOn"
                      type="date"
                      required
                      value={paidOns[item.id] ?? item.dueOn}
                      onChange={(event) => {
                        const value = event.target.value;
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

  const [amountDraft, setAmountDraft] = useState((currentMonth.amountCents / 100).toFixed(2));
  const [extraDraft, setExtraDraft] = useState((suggestedPrincipalCents / 100).toFixed(2));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setAmountDraft((currentMonth.amountCents / 100).toFixed(2));
    setExtraDraft((suggestedPrincipalCents / 100).toFixed(2));
  }, [open, currentMonth.amountCents, suggestedPrincipalCents]);

  const amountCents = useMemo(() => parseAmountToCents(amountDraft), [amountDraft]);
  const extraCents = useMemo(() => parseAmountToCents(extraDraft), [extraDraft]);
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
          <input type="hidden" name="amount" value={amountDraft} />
          <input type="hidden" name="extraAmortization" value={extraDraft} />

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
            <Input
              id={`pay-month-${currentMonth.id}`}
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amountDraft}
              onChange={(event) => setAmountDraft(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`extra-bulk-${currentMonth.id}`}>Amortização antecipada (R$)</Label>
            <Input
              id={`extra-bulk-${currentMonth.id}`}
              type="number"
              step="0.01"
              min="0.01"
              required
              value={extraDraft}
              onChange={(event) => setExtraDraft(event.target.value)}
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
            <Input
              id={`amort-on-${currentMonth.id}`}
              name="paidOn"
              type="date"
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
