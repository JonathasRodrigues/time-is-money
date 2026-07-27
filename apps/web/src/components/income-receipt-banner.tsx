'use client';

import { useOptimistic, useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { formatBrlFromCents, formatCentsForBrInput } from '@tim/domain';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { MoneyInput } from '@/components/ui/money-input';
import { beginActionToast, runWithToast } from '@/lib/action-toast';
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

/**
 * Banner de recebimento — item some na hora (otimista); servidor revalida em background.
 */
export function IncomeReceiptBanner({
  incomeDay,
  pendingIncomes = [],
}: {
  incomeDay?: number | null;
  pendingIncomes?: PendingIncomeItem[];
}): React.ReactElement {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [items, removeOptimistic] = useOptimistic(pendingIncomes, (current, id: string) =>
    current.filter((item) => item.id !== id),
  );

  const hasSeries = items.length > 0;
  const busy = busyKey != null;

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
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => {
                  const toastId = beginActionToast('Confirmando…');
                  setBusyKey('confirm-day');
                  startTransition(async () => {
                    try {
                      await runWithToast(() => confirmIncomeReceiptAction(), {
                        toastId,
                        success: 'Recebimento confirmado',
                      });
                    } catch {
                      // toast / redirect
                    } finally {
                      setBusyKey(null);
                    }
                  });
                }}
              >
                {busyKey === 'confirm-day' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Confirmando…
                  </>
                ) : (
                  'Sim, recebi — contas a pagar'
                )}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                const toastId = beginActionToast('Ok…');
                setBusyKey('snooze');
                startTransition(async () => {
                  try {
                    await runWithToast(() => snoozeIncomeReceiptAction(), {
                      toastId,
                      success: 'Lembrete adiado',
                    });
                  } catch {
                    // toast / redirect
                  } finally {
                    setBusyKey(null);
                  }
                });
              }}
            >
              {busyKey === 'snooze' ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />…
                </>
              ) : (
                'Agora não'
              )}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/payments?flow=receive">Contas a receber</Link>
            </Button>
          </div>
        </div>

        {hasSeries ? (
          <ul className="space-y-2 border-t border-primary/15 pt-3">
            {items.map((item) => {
              const suggestion = item.amountCents ?? item.suggestedCents;
              const active = busyKey === `item:${item.id}`;

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
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const toastId = beginActionToast('Confirmando…');
                      setBusyKey(`item:${item.id}`);
                      startTransition(async () => {
                        removeOptimistic(item.id);
                        try {
                          await runWithToast(() => confirmIncomeItemAction(formData), {
                            toastId,
                            success: 'Receita confirmada',
                          });
                        } catch {
                          // toast; lista volta se falhar
                        } finally {
                          setBusyKey(null);
                        }
                      });
                    }}
                  >
                    <input type="hidden" name="transactionId" value={item.id} />
                    <DateInput
                      name="paidOn"
                      defaultValue={item.dueOn}
                      className="h-8 w-[9.5rem] bg-background"
                      required
                      disabled={busy}
                    />
                    <MoneyInput
                      name="amount"
                      min="0.01"
                      required
                      placeholder="Valor"
                      defaultValue={suggestion != null ? formatCentsForBrInput(suggestion) : ''}
                      className="h-8 w-28 bg-background"
                      disabled={busy}
                    />
                    <Button type="submit" size="sm" disabled={busy}>
                      {active ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Confirmando…
                        </>
                      ) : (
                        'Confirmar'
                      )}
                    </Button>
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
