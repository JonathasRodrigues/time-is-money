'use client';

import { useMemo, useState } from 'react';
import {
  formatBrlFromCents,
  formatIsoDateBr,
  formatMonthsAsDuration,
  MONTH_LABEL_PT,
  parseBrlToCents,
  simulateSavingsGoal,
  sumPlanItems,
  type SavingsLumpRule,
} from '@tim/domain';
import { nativeSelectClassName } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';

export interface PlanGoalItem {
  label: string;
  amountCents: number;
}

interface PlanGoalSimulatorProps {
  /** Meta total; se `items` for passado com valores, a soma dos itens prevalece. */
  targetCents: number;
  savedCents: number;
  targetDate: string;
  defaultMonthlyCents?: number | null;
  /** Detalhamento da meta (hotel, passagem…). A soma vira a meta do simulador. */
  items?: readonly PlanGoalItem[];
}

type DraftLump =
  | { id: string; type: 'annual_lump'; month: string; amount: string }
  | { id: string; type: 'every_n_months'; everyMonths: string; amount: string }
  | { id: string; type: 'one_time'; atMonth: string; amount: string };

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function draftToLumps(drafts: readonly DraftLump[]): SavingsLumpRule[] {
  const rules: SavingsLumpRule[] = [];
  for (const draft of drafts) {
    const cents = parseBrlToCents(draft.amount) ?? 0;
    if (cents <= 0) continue;
    switch (draft.type) {
      case 'annual_lump':
        rules.push({
          type: 'annual_lump',
          month: Math.min(12, Math.max(1, Math.floor(Number(draft.month)) || 12)),
          cents,
        });
        break;
      case 'every_n_months':
        rules.push({
          type: 'every_n_months',
          everyMonths: Math.max(1, Math.floor(Number(draft.everyMonths)) || 12),
          cents,
        });
        break;
      case 'one_time':
        rules.push({
          type: 'one_time',
          atMonth: Math.max(1, Math.floor(Number(draft.atMonth)) || 1),
          cents,
        });
        break;
      default: {
        const _exhaustive: never = draft;
        void _exhaustive;
      }
    }
  }
  return rules;
}

export function PlanGoalSimulator({
  targetCents,
  savedCents,
  targetDate,
  defaultMonthlyCents,
  items,
}: PlanGoalSimulatorProps): React.ReactElement {
  const initialMonthly =
    defaultMonthlyCents != null && defaultMonthlyCents > 0
      ? (defaultMonthlyCents / 100).toFixed(2).replace('.', ',')
      : '800';

  const [monthlyAmount, setMonthlyAmount] = useState(initialMonthly);
  const [yieldPercent, setYieldPercent] = useState('0');
  const [inflationPercent, setInflationPercent] = useState('0');
  const [lumps, setLumps] = useState<DraftLump[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const monthlyCents = parseBrlToCents(monthlyAmount) ?? 0;
  const annualYieldBps = Math.round((Number(yieldPercent.replace(',', '.')) || 0) * 100);
  const annualInflationBps = Math.round((Number(inflationPercent.replace(',', '.')) || 0) * 100);
  const parsedLumps = useMemo(() => draftToLumps(lumps), [lumps]);

  const breakdownItems = useMemo(() => {
    if (items == null || items.length === 0) return [];
    return items
      .map((item) => {
        const label = item.label.trim();
        const amountCents = Math.max(0, item.amountCents);
        if (amountCents <= 0) return null;
        return { label: label || 'Item', amountCents };
      })
      .filter((item): item is PlanGoalItem => item != null);
  }, [items]);

  const effectiveTargetCents =
    breakdownItems.length > 0 ? sumPlanItems(breakdownItems) : Math.max(0, targetCents);

  const simulation = useMemo(
    () =>
      simulateSavingsGoal({
        targetCents: effectiveTargetCents,
        savedCents,
        monthlyContributionCents: monthlyCents,
        lumps: parsedLumps,
        annualYieldBps: annualYieldBps > 0 ? annualYieldBps : undefined,
        annualInflationBps: annualInflationBps > 0 ? annualInflationBps : undefined,
        fromDate: today,
      }),
    [
      effectiveTargetCents,
      savedCents,
      monthlyCents,
      parsedLumps,
      annualYieldBps,
      annualInflationBps,
      today,
    ],
  );

  function addLump(type: DraftLump['type']): void {
    if (type === 'annual_lump') {
      setLumps((prev) => [...prev, { id: newId(), type, month: '12', amount: '2000' }]);
    } else if (type === 'every_n_months') {
      setLumps((prev) => [...prev, { id: newId(), type, everyMonths: '12', amount: '2000' }]);
    } else {
      setLumps((prev) => [...prev, { id: newId(), type, atMonth: '1', amount: '1000' }]);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold">Simulador de reserva</p>
        <p className="text-xs text-muted-foreground">
          Meta {formatBrlFromCents(effectiveTargetCents)} · já guardado{' '}
          {formatBrlFromCents(savedCents)} · alvo {formatIsoDateBr(targetDate)}
        </p>
      </div>

      {breakdownItems.length > 0 ? (
        <ul className="space-y-1 rounded-md border bg-background/50 px-3 py-2 text-sm">
          {breakdownItems.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex items-center justify-between gap-3">
              <span className="truncate text-muted-foreground">{item.label}</span>
              <span className="shrink-0 tabular-nums">{formatBrlFromCents(item.amountCents)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 border-t pt-1.5 font-medium">
            <span>Total da meta</span>
            <span className="tabular-nums">{formatBrlFromCents(effectiveTargetCents)}</span>
          </li>
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goalMonthly">Aporte mensal (R$)</Label>
          <MoneyInput id="goalMonthly" value={monthlyAmount} onValueChange={setMonthlyAmount} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goalYield">Rendimento a.a. (%)</Label>
          <Input
            id="goalYield"
            inputMode="decimal"
            value={yieldPercent}
            onChange={(event) => setYieldPercent(event.target.value)}
            placeholder="0"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goalInflation">Inflação da meta a.a. (%)</Label>
          <Input
            id="goalInflation"
            inputMode="decimal"
            value={inflationPercent}
            onChange={(event) => setInflationPercent(event.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Aportes extras</p>
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => addLump('annual_lump')}>
              + Anual (ex.: dezembro)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => addLump('every_n_months')}
            >
              + Periódico
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => addLump('one_time')}>
              + Único
            </Button>
          </div>
        </div>

        {lumps.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Opcional: 13º, bônus ou aporte pontual para acelerar a meta.
          </p>
        ) : (
          <ul className="space-y-2">
            {lumps.map((lump) => (
              <li
                key={lump.id}
                className="grid gap-2 rounded-md border bg-background/60 p-2 sm:grid-cols-[1fr_auto]"
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  {lump.type === 'annual_lump' ? (
                    <>
                      <span className="self-center text-xs text-muted-foreground">Todo ano em</span>
                      <select
                        className={nativeSelectClassName}
                        value={lump.month}
                        onChange={(event) =>
                          setLumps((prev) =>
                            prev.map((row) =>
                              row.id === lump.id ? { ...row, month: event.target.value } : row,
                            ),
                          )
                        }
                      >
                        {Object.entries(MONTH_LABEL_PT).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <MoneyInput
                        value={lump.amount}
                        onValueChange={(value) =>
                          setLumps((prev) =>
                            prev.map((row) =>
                              row.id === lump.id ? { ...row, amount: value } : row,
                            ),
                          )
                        }
                      />
                    </>
                  ) : null}
                  {lump.type === 'every_n_months' ? (
                    <>
                      <span className="self-center text-xs text-muted-foreground">
                        A cada N meses
                      </span>
                      <Input
                        type="number"
                        min={1}
                        value={lump.everyMonths}
                        onChange={(event) =>
                          setLumps((prev) =>
                            prev.map((row) =>
                              row.id === lump.id
                                ? { ...row, everyMonths: event.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                      <MoneyInput
                        value={lump.amount}
                        onValueChange={(value) =>
                          setLumps((prev) =>
                            prev.map((row) =>
                              row.id === lump.id ? { ...row, amount: value } : row,
                            ),
                          )
                        }
                      />
                    </>
                  ) : null}
                  {lump.type === 'one_time' ? (
                    <>
                      <span className="self-center text-xs text-muted-foreground">
                        Único (mês nº)
                      </span>
                      <Input
                        type="number"
                        min={1}
                        value={lump.atMonth}
                        onChange={(event) =>
                          setLumps((prev) =>
                            prev.map((row) =>
                              row.id === lump.id ? { ...row, atMonth: event.target.value } : row,
                            ),
                          )
                        }
                      />
                      <MoneyInput
                        value={lump.amount}
                        onValueChange={(value) =>
                          setLumps((prev) =>
                            prev.map((row) =>
                              row.id === lump.id ? { ...row, amount: value } : row,
                            ),
                          )
                        }
                      />
                    </>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setLumps((prev) => prev.filter((row) => row.id !== lump.id))}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border bg-background/50 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Tempo projetado</p>
          <p className="font-semibold tabular-nums">
            {simulation.meetsTarget ? formatMonthsAsDuration(simulation.months) : 'Não atinge'}
          </p>
        </div>
        <div className="rounded-md border bg-background/50 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Conclusão</p>
          <p className="font-semibold tabular-nums">
            {simulation.completionDate ? formatIsoDateBr(simulation.completionDate) : '—'}
          </p>
        </div>
        <div className="rounded-md border bg-background/50 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Meta ajustada</p>
          <p className="font-semibold tabular-nums">
            {formatBrlFromCents(simulation.inflatedTargetCents)}
          </p>
        </div>
      </div>

      {!simulation.meetsTarget ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Com este ritmo a meta não é atingida em 50 anos. Aumente o aporte ou adicione extras.
        </p>
      ) : null}
    </div>
  );
}
