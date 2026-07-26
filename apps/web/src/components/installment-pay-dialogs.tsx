'use client';

import { useMemo, useState, useTransition } from 'react';
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
import { payInstallmentAction } from '@/server/actions';

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

/** Confirma pagamento da parcela do mês (sem amortização extra). */
export function PayMonthDialog({
  open,
  onOpenChange,
  installment,
  categories,
  todayIso,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: FinancingInstallmentRow;
  categories: Array<{ id: string; name: string }>;
  todayIso: string;
}): React.ReactElement {
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar parcela #{installment.number}</DialogTitle>
          <DialogDescription>Confirme o pagamento da parcela do mês no extrato.</DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            startTransition(async () => {
              try {
                await runWithToast(() => payInstallmentAction(formData), {
                  loading: 'Registrando pagamento…',
                  success: 'Parcela paga',
                });
                onOpenChange(false);
              } catch {
                // toast já exibido
              }
            });
          }}
          className="grid gap-4"
        >
          <input type="hidden" name="installmentId" value={installment.id} />
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <p className="font-medium tabular-nums">
              {formatBrlFromCents(installment.amountCents)}
            </p>
            <p className="text-xs text-muted-foreground">
              Vence {formatIsoDateBr(installment.dueOn)} · juros{' '}
              {formatBrlFromCents(installment.interestCents)} · amortização{' '}
              {formatBrlFromCents(installment.principalCents)}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`pay-on-${installment.id}`}>Pagar em</Label>
            <Input
              id={`pay-on-${installment.id}`}
              name="paidOn"
              type="date"
              required
              defaultValue={todayIso}
            />
          </div>
          <input type="hidden" name="amount" value={(installment.amountCents / 100).toFixed(2)} />
          <CategorySelect id={`pay-cat-${installment.id}`} categories={categories} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <SubmitButton disabled={pending} pendingLabel="Pagando…">
              Confirmar pagamento
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Amortizar uma parcela futura: paga a do mês atual + amortiza só o principal
 * da parcela escolhida (sem os juros futuros), neste mês, e recalcula o prazo.
 */
export function AmortizeFutureDialog({
  open,
  onOpenChange,
  currentMonth,
  future,
  categories,
  todayIso,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: FinancingInstallmentRow;
  future: FinancingInstallmentRow;
  categories: Array<{ id: string; name: string }>;
  todayIso: string;
}): React.ReactElement {
  const suggestedPrincipalCents =
    future.principalCents > 0
      ? future.principalCents
      : Math.max(0, future.amountCents - future.interestCents);

  const [extraDraft, setExtraDraft] = useState((suggestedPrincipalCents / 100).toFixed(2));
  const [pending, startTransition] = useTransition();

  const extraCents = useMemo(() => parseAmountToCents(extraDraft), [extraDraft]);
  const totalCents = extraCents != null ? currentMonth.amountCents + extraCents : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Amortizar parcela #{future.number}</DialogTitle>
          <DialogDescription>
            Você paga a parcela deste mês e antecipa só o principal da parcela futura — os juros
            dela não entram.
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
          <input type="hidden" name="amount" value={(currentMonth.amountCents / 100).toFixed(2)} />
          <input type="hidden" name="extraAmortization" value={extraDraft} />

          <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Parcela futura #{future.number}
            </p>
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>Valor da parcela</span>
              <span className="tabular-nums">{formatBrlFromCents(future.amountCents)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>Juros (não paga)</span>
              <span className="tabular-nums">− {formatBrlFromCents(future.interestCents)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">Principal a amortizar</span>
              <span className="font-medium tabular-nums">
                {formatBrlFromCents(suggestedPrincipalCents)}
              </span>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border px-3 py-2.5 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              A pagar neste mês
            </p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                Parcela #{currentMonth.number} (juros + amort.)
              </span>
              <span className="tabular-nums">{formatBrlFromCents(currentMonth.amountCents)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Amortização antecipada</span>
              <span className="tabular-nums">
                {extraCents != null ? formatBrlFromCents(extraCents) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-2">
              <span className="font-medium">Total</span>
              <span className="text-base font-semibold tabular-nums">
                {totalCents != null ? formatBrlFromCents(totalCents) : '—'}
              </span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`extra-${future.id}`}>Valor a amortizar (R$)</Label>
            <Input
              id={`extra-${future.id}`}
              type="number"
              step="0.01"
              min="0.01"
              required
              value={extraDraft}
              onChange={(event) => setExtraDraft(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Só principal — sem juros da #{future.number}. O prazo é reduzido mantendo o valor das
              parcelas.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`amort-on-${future.id}`}>Pagar em</Label>
            <Input
              id={`amort-on-${future.id}`}
              name="paidOn"
              type="date"
              required
              defaultValue={todayIso}
            />
          </div>

          <CategorySelect id={`amort-cat-${future.id}`} categories={categories} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <SubmitButton disabled={pending || totalCents == null} pendingLabel="Confirmando…">
              Confirmar neste mês
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
