'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  comparePayoffStrategies,
  formatBrlFromCents,
  formatCentsForBrInput,
  formatIsoDateBr,
  formatMonthsAsDuration,
  labelPayoffExtraRules,
  MONTH_LABEL_PT,
  parseBrlToCents,
  recommendPayoffPlansForTargetDate,
  simulatePayoffByTargetDate,
  simulatePayoffPlan,
  simulateSingleAmortization,
  targetDateFromMonthCount,
  type AmortizationSystem,
  type PayoffApplicationMode,
  type PayoffExtraRule,
  type PayoffPlanRecommendation,
} from '@tim/domain';
import { nativeSelectClassName } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
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
  /** Parcelas pending do financiamento — usadas para escolher do final. */
  pendingInstallments?: ReadonlyArray<{
    number: number;
    dueOn: string;
    principalCents: number;
    amountCents: number;
    interestCents: number;
  }>;
  /** `amortization` = só simulação pontual (plano imobiliário); `payoff` inclui estratégia contínua. */
  variant?: 'payoff' | 'amortization';
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

function rulesToDrafts(rules: readonly PayoffExtraRule[]): DraftRule[] {
  return rules.map((rule) => {
    switch (rule.type) {
      case 'monthly_cents':
        return {
          id: newId(),
          type: 'monthly_cents',
          amount: (rule.cents / 100).toFixed(2).replace('.', ','),
        };
      case 'extra_installments':
        return { id: newId(), type: 'extra_installments', count: String(rule.count) };
      case 'annual_lump':
        return {
          id: newId(),
          type: 'annual_lump',
          month: String(rule.month),
          amount: (rule.cents / 100).toFixed(2).replace('.', ','),
        };
      case 'every_n_months':
        return {
          id: newId(),
          type: 'every_n_months',
          everyMonths: String(rule.everyMonths),
          amount: (rule.cents / 100).toFixed(2).replace('.', ','),
        };
      case 'one_time':
        return {
          id: newId(),
          type: 'one_time',
          atMonth: String(rule.atMonth),
          amount: (rule.cents / 100).toFixed(2).replace('.', ','),
        };
      default: {
        const _exhaustive: never = rule;
        return _exhaustive;
      }
    }
  });
}

function schedulePreviewRows<T>(rows: readonly T[]): readonly T[] {
  if (rows.length <= 8) return rows;
  return [...rows.slice(0, 4), ...rows.slice(-3)];
}

export function PlanPayoffSimulator({
  balanceCents,
  system,
  annualRateBps,
  installmentAmountCents,
  amortizationCents,
  firstDueOn,
  targetDate,
  pendingInstallments,
  variant = 'payoff',
  onSuggestedReserveCents,
}: PlanPayoffSimulatorProps): React.ReactElement {
  const focusedOnly = variant === 'amortization';
  const defaultExtra =
    installmentAmountCents > 0
      ? installmentAmountCents * 2
      : Math.max(amortizationCents * 2, 5_000_00);
  const [extraDraft, setExtraDraft] = useState(formatCentsForBrInput(defaultExtra));
  const [applicationMode, setApplicationMode] = useState<PayoffApplicationMode>('reduce_term');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showTrailing, setShowTrailing] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [includeTargetDate, setIncludeTargetDate] = useState(false);
  const [rules, setRules] = useState<DraftRule[]>([]);
  const [finishByDate, setFinishByDate] = useState(targetDate);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const extraCents = useMemo(() => {
    const cents = parseBrlToCents(extraDraft);
    return cents != null && cents > 0 ? cents : 0;
  }, [extraDraft]);
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

  const singleAmortization = useMemo(() => {
    return simulateSingleAmortization({
      ...planInput,
      extraCents,
      applicationMode,
      installments: pendingInstallments,
    });
  }, [planInput, extraCents, applicationMode, pendingInstallments]);

  const strategies = useMemo(() => {
    if (!advancedOpen && parsedRules.length === 0 && !includeTargetDate) return [];
    return comparePayoffStrategies({
      ...planInput,
      targetDate: includeTargetDate ? targetDate : undefined,
      rules: parsedRules,
      applicationMode,
      fromDate: today,
    });
  }, [advancedOpen, planInput, includeTargetDate, targetDate, parsedRules, applicationMode, today]);

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

  const finishRecommendations = useMemo((): PayoffPlanRecommendation[] => {
    if (!finishByDate) return [];
    return recommendPayoffPlansForTargetDate({
      ...planInput,
      targetDate: finishByDate,
      fromDate: today,
      applicationMode,
    });
  }, [planInput, finishByDate, today, applicationMode]);

  const selectedFinishPlan =
    finishRecommendations.find((plan) => plan.id === selectedPlanId) ??
    finishRecommendations.find((plan) => plan.meetsTarget) ??
    finishRecommendations[0] ??
    null;

  useEffect(() => {
    if (!onSuggestedReserveCents) return;
    if (selectedFinishPlan != null && selectedFinishPlan.averageExtraCents > 0) {
      onSuggestedReserveCents(selectedFinishPlan.averageExtraCents * 12);
      return;
    }
    if (composed != null && composed.averageExtraCents > 0) {
      onSuggestedReserveCents(composed.averageExtraCents * 12);
      return;
    }
    if (targetResult != null && targetResult.simulation.averageExtraCents > 0) {
      onSuggestedReserveCents(targetResult.simulation.averageExtraCents * 12);
      return;
    }
    if (extraCents > 0) {
      onSuggestedReserveCents(
        singleAmortization.trailingSelection?.appliedPrincipalCents ?? extraCents,
      );
    }
  }, [
    selectedFinishPlan,
    composed,
    targetResult,
    extraCents,
    singleAmortization.trailingSelection,
    onSuggestedReserveCents,
  ]);

  const paymentLabel = system === 'sac' ? 'Amortização periódica' : 'Parcela';
  const previewRows = useMemo(
    () => schedulePreviewRows(singleAmortization.scheduleAfter),
    [singleAmortization.scheduleAfter],
  );
  const previewHasGap = singleAmortization.scheduleAfter.length > 8;

  function applyPreset(preset: 'one' | 'two' | 'three' | 'thirteenth' | 'december' | 'fgts'): void {
    setAdvancedOpen(true);
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
    setAdvancedOpen(true);
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

  function applyFinishPlan(plan: PayoffPlanRecommendation): void {
    setSelectedPlanId(plan.id);
    setRules(rulesToDrafts(plan.rules));
    if (!focusedOnly) setAdvancedOpen(true);
    if (plan.averageExtraCents > 0 && onSuggestedReserveCents) {
      onSuggestedReserveCents(plan.averageExtraCents * 12);
    }
  }

  function setFinishInYears(years: number): void {
    setFinishByDate(targetDateFromMonthCount(today, years * 12));
    setSelectedPlanId(null);
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold">
          {focusedOnly ? 'Simular amortização imobiliária' : 'Simular amortização'}
        </p>
        <p className="text-xs text-muted-foreground">
          Saldo residual (principal): {formatBrlFromCents(balanceCents)}
          {pendingInstallments != null && pendingInstallments.length > 0
            ? ` · ${pendingInstallments.length} parcelas pending`
            : null}
          {' · '}
          Informe um valor; o sistema pega o principal das parcelas do{' '}
          <span className="font-medium text-foreground">final</span> até completar o montante.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="singleAmortizationAmount">Valor a amortizar (R$)</Label>
          <MoneyInput
            id="singleAmortizationAmount"
            value={extraDraft}
            onValueChange={setExtraDraft}
            min="0"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payoffApplicationMode">Como aplicar</Label>
          <select
            id="payoffApplicationMode"
            className={nativeSelectClassName}
            value={applicationMode}
            onChange={(event) => setApplicationMode(event.target.value as PayoffApplicationMode)}
          >
            <option value="reduce_term">Reduzir prazo (mantém a parcela)</option>
            <option value="reduce_payment">Reduzir parcela (mantém o prazo)</option>
          </select>
        </div>
      </div>

      {singleAmortization.trailingSelection != null &&
      singleAmortization.trailingSelection.selected.length > 0 ? (
        <div className="space-y-2 rounded-md border bg-background/50 px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                Parcelas do final · #{singleAmortization.trailingSelection.fromNumber}–
                {singleAmortization.trailingSelection.toNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                Principal aplicado:{' '}
                {formatBrlFromCents(singleAmortization.trailingSelection.appliedPrincipalCents)}
                {singleAmortization.trailingSelection.fullyRemovedCount > 0
                  ? ` · ${singleAmortization.trailingSelection.fullyRemovedCount} parcela(s) quitada(s)`
                  : null}
                {singleAmortization.trailingSelection.selected.some((row) => row.partial)
                  ? ' · 1 parcial'
                  : null}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowTrailing((open) => !open)}
            >
              {showTrailing ? 'Ocultar lista' : 'Ver parcelas'}
            </Button>
          </div>
          {showTrailing ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Aplicado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {singleAmortization.trailingSelection.selected.map((row) => (
                  <TableRow key={row.number}>
                    <TableCell className="tabular-nums">
                      #{row.number}
                      {row.partial ? (
                        <Badge variant="secondary" className="ml-2">
                          parcial
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatIsoDateBr(row.dueOn)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBrlFromCents(row.fullPrincipalCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatBrlFromCents(row.principalCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border bg-background/50 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Prazo restante</p>
          <p className="font-semibold tabular-nums">
            {formatMonthsAsDuration(singleAmortization.monthsAfter)}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {extraCents > 0 && singleAmortization.monthsAfter !== singleAmortization.monthsBefore
              ? `antes: ${formatMonthsAsDuration(singleAmortization.monthsBefore)}`
              : `${singleAmortization.monthsAfter} meses`}
          </p>
        </div>
        <div className="rounded-md border bg-background/50 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">{paymentLabel}</p>
          <p className="font-semibold tabular-nums">
            {formatBrlFromCents(singleAmortization.paymentAfterCents)}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {extraCents > 0 &&
            singleAmortization.paymentAfterCents !== singleAmortization.paymentBeforeCents
              ? `antes: ${formatBrlFromCents(singleAmortization.paymentBeforeCents)}`
              : 'sem alteração'}
          </p>
        </div>
        <div className="rounded-md border bg-background/50 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Juros economizados</p>
          <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {singleAmortization.interestSavedCents > 0
              ? formatBrlFromCents(singleAmortization.interestSavedCents)
              : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            total: {formatBrlFromCents(singleAmortization.totalInterestAfterCents)}
          </p>
        </div>
        <div className="rounded-md border bg-background/50 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Quitação em</p>
          <p className="font-semibold tabular-nums">
            {singleAmortization.payoffDateAfter
              ? formatIsoDateBr(singleAmortization.payoffDateAfter)
              : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {extraCents > 0 &&
            singleAmortization.payoffDateBefore != null &&
            singleAmortization.payoffDateAfter !== singleAmortization.payoffDateBefore
              ? `antes: ${formatIsoDateBr(singleAmortization.payoffDateBefore)}`
              : 'cronograma atual'}
          </p>
        </div>
      </div>

      {extraCents > 0 ? (
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowSchedule((open) => !open)}
          >
            {showSchedule ? 'Ocultar novo cronograma' : 'Ver novo cronograma'}
          </Button>
          {showSchedule ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Parcela</TableHead>
                  <TableHead className="text-right">Juros</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, index) => {
                  const showGap = previewHasGap && index === 4;
                  return (
                    <Fragment key={`${row.number}-${row.dueOn}`}>
                      {showGap ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-xs text-muted-foreground"
                          >
                            … {singleAmortization.scheduleAfter.length - 7} parcelas omitidas …
                          </TableCell>
                        </TableRow>
                      ) : null}
                      <TableRow>
                        <TableCell className="tabular-nums">{row.number}</TableCell>
                        <TableCell className="tabular-nums">{formatIsoDateBr(row.dueOn)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBrlFromCents(row.amountCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBrlFromCents(row.interestCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBrlFromCents(row.principalCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBrlFromCents(row.balanceAfterCents)}
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Digite um valor acima para ver o impacto no prazo, na parcela e nos juros.
        </p>
      )}

      <div className="space-y-3 rounded-md border bg-background/40 px-3 py-3">
        <div>
          <p className="text-sm font-semibold">Quero terminar até…</p>
          <p className="text-xs text-muted-foreground">
            Informe a data (ex.: daqui a 5 anos) e veja planos: N parcelas/mês, R$/mês, 13º, combos.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="finishByDate">Data alvo</Label>
            <DateInput
              id="finishByDate"
              value={finishByDate}
              onValueChange={(iso) => {
                setFinishByDate(iso);
                setSelectedPlanId(null);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[3, 5, 10, 15].map((years) => (
              <Button
                key={years}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFinishInYears(years)}
              >
                {years} anos
              </Button>
            ))}
          </div>
        </div>

        {finishByDate && finishRecommendations.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {finishRecommendations.slice(0, 4).map((plan) => {
              const selected = selectedFinishPlan?.id === plan.id;
              return (
                <li key={plan.id}>
                  <button
                    type="button"
                    onClick={() => applyFinishPlan(plan)}
                    className={
                      selected
                        ? 'w-full rounded-md border border-primary bg-primary/5 px-3 py-2 text-left'
                        : 'w-full rounded-md border bg-background/60 px-3 py-2 text-left hover:bg-muted/40'
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{plan.label}</span>
                      {plan.meetsTarget ? (
                        <Badge variant="secondary">fecha a meta</Badge>
                      ) : (
                        <Badge variant="outline">não fecha</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{plan.summary}</p>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {plan.durationLabel} · juros {formatBrlFromCents(plan.totalInterestCents)}
                      {plan.interestSavedCents > 0
                        ? ` · economia ${formatBrlFromCents(plan.interestSavedCents)}`
                        : null}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {selectedFinishPlan != null ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border bg-background/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Plano escolhido</p>
              <p className="font-semibold">{selectedFinishPlan.label}</p>
            </div>
            <div className="rounded-md border bg-background/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Novo prazo</p>
              <p className="font-semibold tabular-nums">{selectedFinishPlan.durationLabel}</p>
            </div>
            <div className="rounded-md border bg-background/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Esforço médio</p>
              <p className="font-semibold tabular-nums">
                {formatBrlFromCents(selectedFinishPlan.averageExtraCents)}/mês
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {!focusedOnly ? (
        <details
          className="rounded-md border bg-background/40"
          open={advancedOpen}
          onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            Estratégia contínua (avançado)
          </summary>
          <div className="space-y-4 border-t px-3 py-3">
            <p className="text-xs text-muted-foreground">
              Combine parcelas extras, 13º, FGTS e data-alvo para uma estratégia ao longo do tempo.
              O modo de aplicação acima (reduzir prazo ou parcela) vale também aqui.
            </p>

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

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Atalhos</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('one')}
                >
                  +1 parcela
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('two')}
                >
                  +2 parcelas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('three')}
                >
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('december')}
                >
                  13º em dezembro
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('fgts')}
                >
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
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => addRule('annual_lump')}
                  >
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
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => addRule('one_time')}
                  >
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
                              onChange={(event) =>
                                updateRule(rule.id, { count: event.target.value })
                              }
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
                              onChange={(event) =>
                                updateRule(rule.id, { month: event.target.value })
                              }
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
                              onChange={(event) =>
                                updateRule(rule.id, { atMonth: event.target.value })
                              }
                            />
                            <MoneyInput
                              value={rule.amount}
                              onValueChange={(value) => updateRule(rule.id, { amount: value })}
                            />
                          </>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRule(rule.id)}
                      >
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
                  <p className="font-semibold tabular-nums">
                    {formatMonthsAsDuration(composed.months)}
                  </p>
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

            {strategies.length > 0 ? (
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
                        <div className="text-[11px] text-muted-foreground">
                          {strategy.months} meses
                        </div>
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
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
