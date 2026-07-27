'use client';

import { useState, useTransition } from 'react';
import type { AmortizationSystem } from '@tim/domain';
import { formatCentsForBrInput } from '@tim/domain';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { nativeSelectClassName } from '@/components/page-header';
import { runWithToast } from '@/lib/action-toast';
import { deleteFinancingAction, rebuildFinancingAction } from '@/server/actions';

export function RebuildFinancingDialog({
  financing,
}: {
  financing: {
    id: string;
    name: string;
    institution: string | null;
    system: AmortizationSystem;
    principalCents: number;
    installmentCount: number;
    installmentAmountCents: number;
    annualRateBps: number | null;
    firstDueOn: string;
    paidCount: number;
  };
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [system, setSystem] = useState<AmortizationSystem>(financing.system);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSystem(financing.system);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Recalcular
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recalcular financiamento</DialogTitle>
          <DialogDescription>
            {financing.paidCount > 0
              ? `Mantém ${financing.paidCount} parcela(s) já paga(s) e regenera só as pendentes.`
              : 'Apaga o cronograma pendente e gera de novo com os parâmetros corretos.'}
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            startTransition(async () => {
              try {
                await runWithToast(() => rebuildFinancingAction(formData), {
                  loading: 'Recalculando…',
                  success: 'Cronograma atualizado',
                });
                setOpen(false);
              } catch {
                // toast já exibido
              }
            });
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="financingId" value={financing.id} />
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={`rf-name-${financing.id}`}>Nome</Label>
            <Input
              id={`rf-name-${financing.id}`}
              name="name"
              required
              defaultValue={financing.name}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={`rf-inst-${financing.id}`}>Instituição</Label>
            <Input
              id={`rf-inst-${financing.id}`}
              name="institution"
              defaultValue={financing.institution ?? ''}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`rf-system-${financing.id}`}>Sistema</Label>
            <select
              id={`rf-system-${financing.id}`}
              name="amortizationSystem"
              className={nativeSelectClassName}
              value={system}
              onChange={(event) => setSystem(event.target.value as AmortizationSystem)}
            >
              <option value="price">Price</option>
              <option value="sac">SAC</option>
              <option value="fixed">Parcela fixa</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`rf-first-${financing.id}`}>1º vencimento</Label>
            <DateInput
              id={`rf-first-${financing.id}`}
              name="firstDueOn"
              required
              defaultValue={financing.firstDueOn}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`rf-principal-${financing.id}`}>Principal (R$)</Label>
            <MoneyInput
              id={`rf-principal-${financing.id}`}
              name="principal"
              min="0.01"
              required
              defaultValue={formatCentsForBrInput(financing.principalCents)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`rf-count-${financing.id}`}>Qtd. parcelas (total)</Label>
            <Input
              id={`rf-count-${financing.id}`}
              name="installmentCount"
              type="number"
              min="1"
              max="600"
              required
              defaultValue={financing.installmentCount}
            />
          </div>
          {system === 'fixed' ? (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={`rf-pmt-${financing.id}`}>Valor da parcela (R$)</Label>
              <MoneyInput
                id={`rf-pmt-${financing.id}`}
                name="installmentAmount"
                min="0.01"
                required
                defaultValue={formatCentsForBrInput(financing.installmentAmountCents)}
              />
            </div>
          ) : (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={`rf-rate-${financing.id}`}>Taxa a.a. (%)</Label>
              <MoneyInput
                id={`rf-rate-${financing.id}`}
                name="annualRate"
                min="0"
                required
                defaultValue={
                  financing.annualRateBps != null
                    ? formatCentsForBrInput(financing.annualRateBps)
                    : '12,50'
                }
              />
              <input type="hidden" name="installmentAmount" value="" />
            </div>
          )}

          <DialogFooter className="sm:col-span-2 flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    'Excluir este financiamento? Parcelas já pagas ficam no histórico do extrato; o contrato some da lista.',
                  )
                ) {
                  return;
                }
                const fd = new FormData();
                fd.set('financingId', financing.id);
                startTransition(async () => {
                  try {
                    await runWithToast(() => deleteFinancingAction(fd), {
                      loading: 'Excluindo…',
                      success: 'Financiamento excluído',
                    });
                    setOpen(false);
                  } catch {
                    // toast já exibido
                  }
                });
              }}
            >
              Excluir contrato
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <SubmitButton isPending={pending} pendingLabel="Recalculando…">
                Recalcular cronograma
              </SubmitButton>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
