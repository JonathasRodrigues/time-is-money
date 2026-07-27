'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  comparePayoffStrategies,
  formatBrlFromCents,
  formatMonthsAsDuration,
  labelPayoffExtraRules,
  MONTH_LABEL_PT,
  parseBrlToCents,
  simulatePayoffByTargetDate,
  simulatePayoffPlan,
  type AmortizationSystem,
  type PayoffApplicationMode,
  type PayoffExtraRule,
} from '@tim/domain';
import { nativeSelectClassName } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type DraftRule =
  | { id: string; type: 'monthly_cents'; amount: string }
  | { id: string; type: 'extra_installments'; count: string }
  | { id: string; type: 'annual_lump'; month: string; amount: string }
  | { id: string; type: 'every_n_months'; everyMonths: string; amount: string }
  | { id: string; type: 'one_time'; atMonth: string; amount: string };

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function draftToRules(drafts: readonly DraftRule[]): PayoffExtraRule[] {
  const rules: PayoffExtraRule[] = [];
  for (const draft of drafts) {
    switch (draft.type) {
      case 'monthly_cents': {
        const cents = parseBrlToCents(draft.amount) ?? 0;
        if (cents > 0) rules.push({ type: 'monthly_cents', cents });
        break;
      }
      case 'extra_installments': {
        const count = Math.floor(Number(draft.count));
        if (count > 0) rules.push({ type: 'extra_installments', count });
        break;
      }
      case 'annual_lump': {
        const cents = parseBrlToCents(draft.amount) ?? 0;
        const month = Math.min(12, Math.max(1, Math.floor(Number(draft.month)) || 12));
        if (cents > 0) rules.push({ type: 'annual_lump', month, cents });
        break;
      }
      case 'every_n_months': {
        const cents = parseBrlToCents(draft.amount) ?? 0;
        const everyMonths = Math.max(1, Math.floor(Number(draft.everyMonths)) || 24);
        if (cents > 0) rules.push({ type: 'every_n_months', everyMonths, cents });
        break;
      }
      case 'one_time': {
        const cents = parseBrlToCents(draft.amount) ?? 0;
        const atMonth = Math.max(1, Math.floor(Number(draft.atMonth)) || 1);
        if (cents > 0) rules.push({ type: 'one_time', atMonth, cents });
        break;
      }
      default: {
        const _exhaustive: never = draft;
        void _exhaustive;
      }
    }
  }
  return rules;
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
  const [applicationMode, setApplicationMode] = useState<PayoffApplicationMode>('reduce_term');
  const [includeTargetDate, setIncludeTargetDate] = useState(false);
  const [rules, setRules] = useState<DraftRule[]>([
    { id: newId(), type: 'extra_installments', count: '2' },
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const parsedRules = useMemo(() => draftToRules(rules), [rules]);

  const planInput = useMemo(
    () => ({
      balanceCents,
      system,
      annualRateBps: annualRateBps ?? undefined,
      installmentAmountCents,
      amortizationCents,
      firstDueOn,
    }),
    [balanceCents, system, annualRateBps, installmentAmountCents, amortizationCents, firstDueOn],
  );

  const strategies = useMemo(() => {
    return comparePayoffStrategies({
      ...planInput,
      targetDate: includeTargetDate ? targetDate : undefined,
      rules: parsedRules,
      applicationMode,
      fromDate: today,
    });
  }, [planInput, includeTargetDate, targetDate, parsedRules, applicationMode, today]);

  const composed = useMemo(() => {
    if (parsedRules.length === 0) return null;
    return simulatePayoffPlan({
      ...planInput,
      rules: parsedRules,
      applicationMode,
    });
  }, [planInput, parsedRules, applicationMode]);

  const targetResult = useMemo(() => {
    if (!includeTargetDate || !targetDate) return null;
    return simulatePayoffByTargetDate({
      ...planInput,
      targetDate,
      fromDate: today,
      baseRules: parsedRules,
      applicationMode,
    });
  }, [includeTargetDate, targetDate, planInput, today, parsedRules, applicationMode]);

  useEffect(() => {
    if (!onSuggestedReserveCents) return;
    const average = composed?.averageExtraCents ?? targetResult?.simulation.averageExtraCents ?? 0;
    if (average > 0) {
      onSuggestedReserveCents(average * 12);
    }
  }, [composed, targetResult, onSuggestedReserveCents]);

  function applyPreset(preset: 'one' | 'two' | 'three' | 'thirteenth' | 'december' | 'fgts'): void {
    setRules((prev) => {
      const next = [...prev];
      switch (preset) {
        case 'one':
          next.push({ id: newId(), type: 'extra_installments', count: '1' });
          break;
        case 'two':
          next.push({ id: newId(), type: 'extra_installments', count: '2' });
          break;
        case 'three':
          next.push({ id: newId(), type: 'extra_installments', count: '3' });
          break;
        case 'thirteenth': {
          const thirteenth = Math.round(installmentAmountCents / 12);
          next.push({
            id: newId(),
            type: 'monthly_cents',
            amount: (thirteenth / 100).toFixed(2).replace('.', ','),
          });
          break;
        }
        case 'december':
          next.push({ id: newId(), type: 'annual_lump', month: '12', amount: '10000' });
          break;
        case 'fgts':
          next.push({ id: newId(), type: 'every_n_months', everyMonths: '24', amount: '20000' });
          break;
        default: {
          const _exhaustive: never = preset;
          void _exhaustive;
        }
      }
      return next;
    });
  }

  function addRule(type: DraftRule['type']): void {
    switch (type) {
      case 'monthly_cents':
        setRules((prev) => [...prev, { id: newId(), type, amount: '500' }]);
        break;
      case 'extra_installments':
        setRules((prev) => [...prev, { id: newId(), type, count: '1' }]);
        break;
      case 'annual_lump':
        setRules((prev) => [...prev, { id: newId(), type, month: '12', amount: '10000' }]);
        break;
      case 'every_n_months':
        setRules((prev) => [...prev, { id: newId(), type, everyMonths: '24', amount: '20000' }]);
        break;
      case 'one_time':
        setRules((prev) => [...prev, { id: newId(), type, atMonth: '1', amount: '5000' }]);
        break;
      default: {
        const _exhaustive: never = type;
        void _exhaustive;
      }
    }
  }

  function updateRule(id: string, patch: Partial<DraftRule>): void {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== id) return rule;
        return { ...rule, ...patch } as DraftRule;
      }),
    );
  }

  function removeRule(id: string): void {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold">Simulador de quitação</p>
        <p className="text-xs text-muted-foreground">
          Saldo residual (principal): {formatBrlFromCents(balanceCents)} · Combine parcelas extras,
          13º, FGTS e data-alvo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payoffApplicationMode">Ao amortizar</Label>
          <select
            id="payoffApplicationMode"
            className={nativeSelectClassName}
            value={applicationMode}
            onChange={(event) => setApplicationMode(event.target.value as PayoffApplicationMode)}
          >
            <option value="reduce_term">Reduzir prazo (maior economia)</option>
            <option value="reduce_payment">Reduzir parcela (alívio no caixa)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5 justify-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeTargetDate}
              onChange={(event) => setIncludeTargetDate(event.target.checked)}
              className="size-4 rounded border"
            />
            Também calcular extra para quitar até a data alvo
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Atalhos</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('one')}>
            +1 parcela
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('two')}>
            +2 parcelas
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('three')}>
            +3 parcelas
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyPreset('thirteenth')}
          >
            13ª parcela
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('december')}>
            13º em dezembro
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('fgts')}>
            FGTS / 2 anos
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Regras de amortização</p>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => addRule('extra_installments')}
            >
              + Parcelas
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => addRule('monthly_cents')}
            >
              + R$/mês
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => addRule('annual_lump')}>
              + Anual
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => addRule('every_n_months')}
            >
              + Periódico
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => addRule('one_time')}>
              + Único
            </Button>
          </div>
        </div>

        {rules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma regra — use os atalhos ou adicione uma regra.
          </p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="grid gap-2 rounded-md border bg-background/60 p-2 sm:grid-cols-[1fr_auto]"
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  {rule.type === 'extra_installments' ? (
                    <>
                      <span className="text-xs text-muted-foreground self-center">
                        Parcelas extras / mês
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={rule.count}
                        onChange={(event) => updateRule(rule.id, { count: event.target.value })}
                        className="sm:col-span-2"
                      />
                    </>
                  ) : null}
                  {rule.type === 'monthly_cents' ? (
                    <>
                      <span className="text-xs text-muted-foreground self-center">
                        Extra R$/mês
                      </span>
                      <MoneyInput
                        value={rule.amount}
                        onValueChange={(value) => updateRule(rule.id, { amount: value })}
                        className="sm:col-span-2"
                      />
                    </>
                  ) : null}
                  {rule.type === 'annual_lump' ? (
                    <>
                      <span className="text-xs text-muted-foreground self-center">
                        Aporte anual
                      </span>
                      <select
                        className={nativeSelectClassName}
                        value={rule.month}
                        onChange={(event) => updateRule(rule.id, { month: event.target.value })}
                      >
                        {Object.entries(MONTH_LABEL_PT).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <MoneyInput
                        value={rule.amount}
                        onValueChange={(value) => updateRule(rule.id, { amount: value })}
                      />
                    </>
                  ) : null}
                  {rule.type === 'every_n_months' ? (
                    <>
                      <span className="text-xs text-muted-foreground self-center">
                        A cada N meses
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={rule.everyMonths}
                        onChange={(event) =>
                          updateRule(rule.id, { everyMonths: event.target.value })
                        }
                      />
                      <MoneyInput
                        value={rule.amount}
                        onValueChange={(value) => updateRule(rule.id, { amount: value })}
                      />
                    </>
                  ) : null}
                  {rule.type === 'one_time' ? (
                    <>
                      <span className="text-xs text-muted-foreground self-center">
                        Único (mês nº)
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={600}
                        value={rule.atMonth}
                        onChange={(event) => updateRule(rule.id, { atMonth: event.target.value })}
                      />
                      <MoneyInput
                        value={rule.amount}
                        onValueChange={(value) => updateRule(rule.id, { amount: value })}
                      />
                    </>
                  ) : null}
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeRule(rule.id)}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}

        {parsedRules.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Cenário: {labelPayoffExtraRules(parsedRules)}
          </p>
        ) : null}
      </div>

      {composed ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border bg-background/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Novo prazo</p>
            <p className="font-semibold tabular-nums">{formatMonthsAsDuration(composed.months)}</p>
          </div>
          <div className="rounded-md border bg-background/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Esforço médio</p>
            <p className="font-semibold tabular-nums">
              {formatBrlFromCents(composed.averageExtraCents)}/mês
            </p>
          </div>
          <div className="rounded-md border bg-background/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Juros no cenário</p>
            <p className="font-semibold tabular-nums">
              {formatBrlFromCents(composed.totalInterestCents)}
            </p>
          </div>
        </div>
      ) : null}

      {targetResult && includeTargetDate ? (
        <p className="text-sm">
          Extra mensal adicional para a data alvo:{' '}
          <span className="font-semibold tabular-nums">
            {formatBrlFromCents(targetResult.extraMonthlyCents)}/mês
          </span>
          {parsedRules.length > 0 ? (
            <span className="text-xs text-muted-foreground"> (além das regras acima)</span>
          ) : null}
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
                      ~{formatBrlFromCents(strategy.extraMonthlyCents)}/mês
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <div>{strategy.durationLabel}</div>
                <div className="text-[11px] text-muted-foreground">{strategy.months} meses</div>
              </TableCell>
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
