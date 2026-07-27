'use client';

import { useMemo, useTransition } from 'react';
import {
  analyzeContributionSchedule,
  formatBrlFromCents,
  formatCentsForBrInput,
  formatIsoDateBr,
  parseBrlToCents,
  type PlanContributionRow,
} from '@tim/domain';
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
import { runWithToast } from '@/lib/action-toast';
import { upsertPlanContributionsAction } from '@/server/actions';

export type ContributionRow = PlanContributionRow;

interface PlanContributionScheduleProps {
  targetCents: number;
  savedCents?: number;
  monthlyTargetCents?: number | null;
  contributions: ContributionRow[];
  onChange?: (rows: ContributionRow[]) => void;
  readOnly?: boolean;
  planId?: string;
}

export function PlanContributionSchedule({
  targetCents,
  savedCents = 0,
  monthlyTargetCents,
  contributions,
  onChange,
  readOnly = false,
  planId,
}: PlanContributionScheduleProps): React.ReactElement {
  const [pending, startTransition] = useTransition();

  const analysis = useMemo(
    () =>
      analyzeContributionSchedule({
        targetCents,
        savedCents,
        contributions,
      }),
    [targetCents, savedCents, contributions],
  );

  function updateRow(index: number, amountCents: number): void {
    if (!onChange) return;
    onChange(contributions.map((row, i) => (i === index ? { ...row, amountCents } : row)));
  }

  function saveSchedule(): void {
    if (!planId) return;
    startTransition(async () => {
      await runWithToast(
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
        { loading: 'Salvando cronograma…', success: 'Cronograma atualizado' },
      );
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Cronograma de aportes</p>
          {monthlyTargetCents != null && monthlyTargetCents > 0 ? (
            <p className="text-xs text-muted-foreground">
              Estratégia: {formatBrlFromCents(monthlyTargetCents)}/mês
            </p>
          ) : null}
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

      {analysis.gapCents > 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          Com essa estratégia ainda faltam {formatBrlFromCents(analysis.gapCents)} para bater a meta
          até a data. Ajuste meses específicos ou aumente o valor mensal.
        </p>
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
    <div className="rounded-md border bg-background/80 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('text-xs font-semibold tabular-nums', className)}>{value}</p>
    </div>
  );
}
