'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  comparePayoffStrategies,
  formatBrlFromCents,
  simulatePayoffByTargetDate,
  type AmortizationSystem,
} from '@tim/domain';
import { nativeSelectClassName } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
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

interface PlanPayoffSimulatorProps {
  balanceCents: number;
  system: AmortizationSystem;
  annualRateBps: number | null;
  installmentAmountCents: number;
  amortizationCents: number;
  firstDueOn: string;
  targetDate: string;
  onSuggestedReserveCents?: (cents: number) => void;
}

export function PlanPayoffSimulator({
  balanceCents,
  system,
  annualRateBps,
  installmentAmountCents,
  amortizationCents,
  firstDueOn,
  targetDate,
  onSuggestedReserveCents,
}: PlanPayoffSimulatorProps): React.ReactElement {
  const [mode, setMode] = useState<'target_date' | 'extra_payment'>('target_date');
  const [extraPayment, setExtraPayment] = useState('500');

  const today = new Date().toISOString().slice(0, 10);

  const strategies = useMemo(() => {
    const extraCents = Math.round(Number(extraPayment.replace(',', '.')) * 100) || 0;
    return comparePayoffStrategies({
      balanceCents,
      system,
      annualRateBps: annualRateBps ?? undefined,
      installmentAmountCents,
      amortizationCents,
      firstDueOn,
      targetDate: mode === 'target_date' ? targetDate : undefined,
      extraPaymentCents: mode === 'extra_payment' ? extraCents : undefined,
      fromDate: today,
    });
  }, [
    balanceCents,
    system,
    annualRateBps,
    installmentAmountCents,
    amortizationCents,
    firstDueOn,
    targetDate,
    mode,
    extraPayment,
    today,
  ]);

  const targetResult = useMemo(() => {
    if (mode !== 'target_date') return null;
    return simulatePayoffByTargetDate({
      balanceCents,
      system,
      annualRateBps: annualRateBps ?? undefined,
      installmentAmountCents,
      amortizationCents,
      firstDueOn,
      targetDate,
      fromDate: today,
    });
  }, [
    mode,
    balanceCents,
    system,
    annualRateBps,
    installmentAmountCents,
    amortizationCents,
    firstDueOn,
    targetDate,
    today,
  ]);

  useEffect(() => {
    if (targetResult && onSuggestedReserveCents) {
      onSuggestedReserveCents(targetResult.extraMonthlyCents * 12);
    }
  }, [targetResult, onSuggestedReserveCents]);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold">Simulador de quitação</p>
        <p className="text-xs text-muted-foreground">
          Saldo devedor estimado: {formatBrlFromCents(balanceCents)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payoffMode">Estratégia</Label>
          <select
            id="payoffMode"
            className={nativeSelectClassName}
            value={mode}
            onChange={(event) => setMode(event.target.value as 'target_date' | 'extra_payment')}
          >
            <option value="target_date">Quitar até a data alvo</option>
            <option value="extra_payment">Amortização extra fixa/mês</option>
          </select>
        </div>
        {mode === 'extra_payment' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extraPayment">Extra mensal (R$)</Label>
            <MoneyInput id="extraPayment" value={extraPayment} onValueChange={setExtraPayment} />
          </div>
        ) : null}
      </div>

      {targetResult && mode === 'target_date' ? (
        <p className="text-sm">
          Amortização extra necessária:{' '}
          <span className="font-semibold tabular-nums">
            {formatBrlFromCents(targetResult.extraMonthlyCents)}/mês
          </span>
        </p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cenário</TableHead>
            <TableHead className="text-right">Prazo</TableHead>
            <TableHead className="text-right">Juros</TableHead>
            <TableHead className="text-right">Economia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {strategies.map((strategy) => (
            <TableRow key={strategy.label}>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">{strategy.label}</span>
                  {strategy.extraMonthlyCents > 0 ? (
                    <Badge variant="secondary" className="tabular-nums">
                      +{formatBrlFromCents(strategy.extraMonthlyCents)}/mês
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{strategy.months} meses</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBrlFromCents(strategy.totalInterestCents)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                {strategy.interestSavedCents > 0
                  ? formatBrlFromCents(strategy.interestSavedCents)
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
