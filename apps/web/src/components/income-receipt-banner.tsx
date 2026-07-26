'use client';

import Link from 'next/link';
import { formatBrlFromCents } from '@tim/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { withActionToast } from '@/lib/action-toast';
import {
  confirmIncomeItemAction,
  confirmIncomeReceiptAction,
  snoozeIncomeReceiptAction,
} from '@/server/actions';

export interface PendingIncomeItem {
  id: string;
  description: string;
  dueOn: string;
  amountCents: number | null;
  suggestedCents: number | null;
}

export function IncomeReceiptBanner({
  incomeDay,
  pendingIncomes = [],
}: {
  incomeDay?: number | null;
  pendingIncomes?: PendingIncomeItem[];
}): React.ReactElement {
  const today = new Date().toISOString().slice(0, 10);
  const hasSeries = pendingIncomes.length > 0;

  return (
    <div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 px-4 py-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold tracking-tight">
              {hasSeries ? 'Confirmar recebimentos do mês' : 'Dia de recebimento'}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasSeries
                ? 'Receitas fixas (salário, VR…) — confirme o valor quando cair. Não precisa lançar do zero todo mês.'
                : `Configurado para o dia ${incomeDay}. O dinheiro já caiu na conta?`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!hasSeries ? (
              <form
                action={withActionToast(confirmIncomeReceiptAction, {
                  loading: 'Confirmando…',
                  success: 'Recebimento confirmado',
                })}
              >
                <SubmitButton size="sm" pendingLabel="Confirmando…">
                  Sim, recebi — contas a pagar
                </SubmitButton>
              </form>
            ) : null}
            <form
              action={withActionToast(snoozeIncomeReceiptAction, {
                loading: 'Ok…',
                success: 'Lembrete adiado',
              })}
            >
              <SubmitButton size="sm" variant="outline" pendingLabel="…">
                Agora não
              </SubmitButton>
            </form>
            <Button asChild size="sm" variant="ghost">
              <Link href="/payments">Contas a pagar</Link>
            </Button>
          </div>
        </div>

        {hasSeries ? (
          <ul className="space-y-2 border-t border-primary/15 pt-3">
            {pendingIncomes.map((item) => {
              const suggestion = item.amountCents ?? item.suggestedCents;
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Previsto para {item.dueOn.slice(8, 10)}/{item.dueOn.slice(5, 7)}
                      {item.suggestedCents != null && item.amountCents == null
                        ? ` · sugestão ${formatBrlFromCents(item.suggestedCents)}`
                        : null}
                    </p>
                  </div>
                  <form
                    action={withActionToast(confirmIncomeItemAction, {
                      loading: 'Confirmando…',
                      success: 'Receita confirmada',
                    })}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="transactionId" value={item.id} />
                    <input type="hidden" name="paidOn" value={today} />
                    <Input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="Valor"
                      defaultValue={suggestion != null ? (suggestion / 100).toFixed(2) : ''}
                      className="h-8 w-28 bg-background"
                    />
                    <SubmitButton size="sm" pendingLabel="…">
                      Confirmar
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function PaydayReadyBanner(): React.ReactElement {
  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-card px-4 py-3.5 shadow-sm">
      <p className="text-sm font-medium">Recebimento confirmado</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Agora é boa hora de quitar as contas a pagar — comece pelas atrasadas e fixas.
      </p>
    </div>
  );
}
