'use client';

import { useMemo } from 'react';
import {
  analyzeContributionSchedule,
  buildMonthlyContributionSchedule,
  formatBrlFromCents,
  parseBrlToCents,
  targetDateFromMonthCount,
  type PlanContributionRow,
} from '@tim/domain';
import { Wand2 } from 'lucide-react';
import { PlanContributionSchedule } from '@/components/plan-contribution-schedule';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PlanScheduleGenerator({
  goalName,
  goalAmount,
  monthCount,
  monthlyAmount,
  contributions,
  onGoalNameChange,
  onGoalAmountChange,
  onMonthCountChange,
  onMonthlyAmountChange,
  onContributionsChange,
  onTargetDateChange,
}: {
  goalName: string;
  goalAmount: string;
  monthCount: string;
  monthlyAmount: string;
  contributions: PlanContributionRow[];
  onGoalNameChange: (value: string) => void;
  onGoalAmountChange: (value: string) => void;
  onMonthCountChange: (value: string) => void;
  onMonthlyAmountChange: (value: string) => void;
  onContributionsChange: (rows: PlanContributionRow[]) => void;
  onTargetDateChange: (isoDate: string) => void;
}): React.ReactElement {
  const targetCents = parseBrlToCents(goalAmount) ?? 0;
  const monthlyCents = parseBrlToCents(monthlyAmount) ?? 0;
  const months = Math.max(1, Math.min(120, Number(monthCount) || 1));

  const preview = useMemo(() => {
    if (contributions.length === 0) return null;
    return analyzeContributionSchedule({
      targetCents,
      savedCents: 0,
      contributions,
    });
  }, [contributions, targetCents]);

  function generate(): void {
    const startOn = todayIso();
    const rows = buildMonthlyContributionSchedule({
      startOn,
      monthCount: months,
      monthlyCents,
    });
    onContributionsChange(rows);
    onTargetDateChange(targetDateFromMonthCount(startOn, months));
    if (!goalName.trim() && goalAmount) {
      onGoalNameChange('Minha meta');
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-dashed bg-muted/10 p-4">
      <div className="flex items-center gap-2">
        <Wand2 className="size-4 text-primary" />
        <p className="text-sm font-semibold">Gerar cronograma</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Ex.: Disney em 10 meses, meta de R$ 10.000 guardando R$ 800/mês — depois ajuste meses
        específicos para fechar a meta.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="genName">Nome do plano</Label>
          <Input
            id="genName"
            value={goalName}
            onChange={(event) => onGoalNameChange(event.target.value)}
            placeholder="Viagem Disney"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="genGoal">Meta total (R$)</Label>
          <MoneyInput
            id="genGoal"
            value={goalAmount}
            onValueChange={onGoalAmountChange}
            placeholder="10000"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="genMonths">Prazo (meses)</Label>
          <Input
            id="genMonths"
            type="number"
            min={1}
            max={120}
            value={monthCount}
            onChange={(event) => onMonthCountChange(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="genMonthly">Guardar por mês (R$)</Label>
          <MoneyInput
            id="genMonthly"
            value={monthlyAmount}
            onValueChange={onMonthlyAmountChange}
            placeholder="800"
          />
        </div>
      </div>

      <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={generate}>
        <Wand2 className="size-4" />
        Gerar {months} meses de {formatBrlFromCents(monthlyCents) || '—'}
      </Button>

      {preview && contributions.length > 0 ? (
        <PlanContributionSchedule
          targetCents={targetCents}
          savedCents={0}
          monthlyTargetCents={monthlyCents > 0 ? monthlyCents : null}
          contributions={contributions}
          onChange={onContributionsChange}
          items={
            targetCents > 0
              ? [{ label: goalName.trim() || 'Meta', amountCents: targetCents }]
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
