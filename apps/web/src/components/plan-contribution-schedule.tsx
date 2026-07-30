'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  analyzeContributionSchedule,
  applyGapToLastContribution,
  buildMonthlyContributionSchedule,
  computeMonthlySavingsNeeded,
  formatBrlFromCents,
  formatCentsForBrInput,
  formatIsoDateBr,
  monthsUntil,
  parseBrlToCents,
  redistributeContributionsToTarget,
  type PlanContributionRow,
} from '@tim/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useMutationFeedback } from '@/hooks/use-mutation-feedback';
import { upsertPlanContributionsAction } from '@/lib/api/mutations';

export type ContributionRow = PlanContributionRow;

export interface ContributionMetaItem {
  label: string;
  amountCents: number;
}

interface PlanContributionScheduleProps {
  targetCents: number;
  savedCents?: number;
  monthlyTargetCents?: number | null;
  contributions: ContributionRow[];
  onChange?: (rows: ContributionRow[]) => void;
  readOnly?: boolean;
  planId?: string;
  targetDate?: string;
  /** Itens da meta — a soma deve bater com targetCents. */
  items?: readonly ContributionMetaItem[];
}

export function PlanContributionSchedule({
  targetCents,
  savedCents = 0,
  monthlyTargetCents,
  contributions,
  onChange,
  readOnly = false,
  planId,
  targetDate,
  items,
}: PlanContributionScheduleProps): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const { run } = useMutationFeedback();
  const [genMonths, setGenMonths] = useState(() => {
    if (targetDate) {
      const months = monthsUntil(targetDate);
      return String(Math.max(1, months || 12));
    }
    return '12';
  });

  const analysis = useMemo(
    () =>
      analyzeContributionSchedule({
        targetCents,
        savedCents,
        contributions,
      }),
    [targetCents, savedCents, contributions],
  );

  const breakdownItems = useMemo(() => {
    if (items == null || items.length === 0) return [];
    return items.filter((item) => item.amountCents > 0 && item.label.trim());
  }, [items]);

  function updateRow(index: number, amountCents: number): void {
    if (!onChange) return;
    onChange(contributions.map((row, i) => (i === index ? { ...row, amountCents } : row)));
  }

  function redistributeEvenly(): void {
    if (!onChange || contributions.length === 0) return;
    onChange(
      redistributeContributionsToTarget({
        contributions,
        targetCents,
        savedCents,
      }),
    );
  }

  function closeGapOnLastMonth(): void {
    if (!onChange || contributions.length === 0 || analysis.gapCents === 0) return;
    onChange(applyGapToLastContribution(contributions, analysis.gapCents));
  }

  function generateSchedule(): void {
    if (!onChange) return;
    const monthCount = Math.max(1, Math.min(120, Number(genMonths) || 12));
    const monthly =
      monthlyTargetCents != null && monthlyTargetCents > 0
        ? monthlyTargetCents
        : computeMonthlySavingsNeeded({
            targetCents,
            savedCents,
            targetDate: targetDate ?? new Date().toISOString().slice(0, 10),
          });
    const startOn = new Date().toISOString().slice(0, 10);
    const rows = buildMonthlyContributionSchedule({
      startOn,
      monthCount,
      monthlyCents: Math.max(0, monthly),
    });
    onChange(
      redistributeContributionsToTarget({
        contributions: rows,
        targetCents,
        savedCents,
      }),
    );
  }

  function saveSchedule(): void {
    if (!planId) return;
    startTransition(async () => {
      await run(
        () =>
          upsertPlanContributionsAction({
            planId,
            monthlyTargetCents: monthlyTargetCents ?? null,
            contributions: contributions.map((row, index) => ({
              dueOn: row.dueOn,
              amountCents: row.amountCents,
              sortOrder: index,
            })),
          }),
        {
          loading: 'Salvando cronograma…',
          success: 'Cronograma atualizado',
          invalidate: 'financing',
        },
      );
    });
  }

  if (contributions.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <div>
          <p className="text-sm font-semibold">Cronograma de aportes</p>
          <p className="text-xs text-muted-foreground">
            Meta {formatBrlFromCents(targetCents)} · já guardado {formatBrlFromCents(savedCents)}.
            Gere meses de aporte para acompanhar a reserva.
          </p>
        </div>
        {breakdownItems.length > 0 ? <ItemsBreakdown items={breakdownItems} /> : null}
        {!readOnly && onChange ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="genContributionMonths">Meses</Label>
              <Input
                id="genContributionMonths"
                type="number"
                min={1}
                max={120}
                value={genMonths}
                onChange={(event) => setGenMonths(event.target.value)}
                className="w-24"
              />
            </div>
            <Button type="button" size="sm" onClick={generateSchedule}>
              Gerar aportes pela meta
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum aporte planejado.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Cronograma de aportes</p>
          <p className="text-xs text-muted-foreground">
            Meta dos itens {formatBrlFromCents(targetCents)}
            {monthlyTargetCents != null && monthlyTargetCents > 0
              ? ` · estratégia ${formatBrlFromCents(monthlyTargetCents)}/mês`
              : null}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-4">
          <SummaryPill label="Meta" value={formatBrlFromCents(analysis.targetCents)} />
          <SummaryPill label="Planejado" value={formatBrlFromCents(analysis.plannedCents)} />
          <SummaryPill label="Projeção" value={formatBrlFromCents(analysis.projectedTotalCents)} />
          <SummaryPill
            label={analysis.gapCents > 0 ? 'Falta' : analysis.gapCents < 0 ? 'Sobra' : 'Fechou'}
            value={formatBrlFromCents(Math.abs(analysis.gapCents))}
            className={cn(
              analysis.gapCents > 0 && 'text-amber-600 dark:text-amber-400',
              analysis.gapCents < 0 && 'text-emerald-600 dark:text-emerald-400',
              analysis.gapCents === 0 && 'text-emerald-600 dark:text-emerald-400',
            )}
          />
        </div>
      </div>

      {breakdownItems.length > 0 ? <ItemsBreakdown items={breakdownItems} /> : null}

      {analysis.gapCents !== 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {analysis.gapCents > 0
            ? `Com essa estratégia ainda faltam ${formatBrlFromCents(analysis.gapCents)} para bater a meta dos itens.`
            : `Os aportes passam da meta em ${formatBrlFromCents(Math.abs(analysis.gapCents))}.`}{' '}
          Redistribua ou ajuste meses específicos.
        </p>
      ) : null}

      {!readOnly && onChange ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={redistributeEvenly}>
            Redistribuir pela meta
          </Button>
          {analysis.gapCents !== 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={closeGapOnLastMonth}>
              {analysis.gapCents > 0 ? 'Fechar gap no último mês' : 'Tirar sobra do último mês'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Mês</TableHead>
            <TableHead className="text-right w-44">Guardar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contributions.map((row, index) => (
            <TableRow key={`${row.dueOn}-${index}`}>
              <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="tabular-nums">{formatIsoDateBr(row.dueOn)}</TableCell>
              <TableCell className="text-right">
                {readOnly ? (
                  <span className="tabular-nums font-medium">
                    {formatBrlFromCents(row.amountCents)}
                  </span>
                ) : (
                  <MoneyInput
                    value={formatCentsForBrInput(row.amountCents)}
                    onValueChange={(raw) => {
                      const cents = parseBrlToCents(raw);
                      updateRow(index, cents ?? 0);
                    }}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!readOnly && planId ? (
        <div className="flex justify-end">
          <SubmitButton type="button" size="sm" isPending={pending} onClick={saveSchedule}>
            Salvar cronograma
          </SubmitButton>
        </div>
      ) : null}
    </div>
  );
}

function ItemsBreakdown({ items }: { items: readonly ContributionMetaItem[] }): React.ReactElement {
  const total = items.reduce((sum, item) => sum + item.amountCents, 0);
  return (
    <ul className="space-y-1 rounded-md border bg-background/50 px-3 py-2 text-sm">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="flex items-center justify-between gap-3">
          <span className="truncate text-muted-foreground">{item.label}</span>
          <span className="shrink-0 tabular-nums">{formatBrlFromCents(item.amountCents)}</span>
        </li>
      ))}
      <li className="flex items-center justify-between gap-3 border-t pt-1.5 font-medium">
        <span>Total da meta</span>
        <span className="tabular-nums">{formatBrlFromCents(total)}</span>
      </li>
    </ul>
  );
}

function SummaryPill({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}): React.ReactElement {
  return (
    <div className="min-w-[4.5rem]">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', className)}>{value}</p>
    </div>
  );
}
