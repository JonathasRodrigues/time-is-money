'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  formatBrlFromCents,
  formatIsoDateBr,
  PLAN_KIND_LABEL,
  computeMonthlySavingsNeeded,
  computePlanProgress,
  type PlanKind,
} from '@tim/domain';
import { ChevronDown, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { PlanItemsTable, type PlanItemRow } from '@/components/plan-items-table';
import { PlanPayoffSimulator } from '@/components/plan-payoff-simulator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { runWithToast } from '@/lib/action-toast';
import { deletePlanAction } from '@/server/actions';
import type { AmortizationSystem } from '@tim/domain';

export interface PlanCardData {
  id: string;
  kind: PlanKind;
  name: string;
  targetDate: string;
  savedCents: number;
  targetCents: number;
  linkedAccountName: string | null;
  financingName: string | null;
  items: PlanItemRow[];
  financingPayoff?: {
    balanceCents: number;
    system: AmortizationSystem;
    annualRateBps: number | null;
    installmentAmountCents: number;
    amortizationCents: number;
    firstDueOn: string;
  };
  canWrite: boolean;
}

export function PlanCard({ plan }: { plan: PlanCardData }): React.ReactElement {
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();

  const progress = computePlanProgress(plan.savedCents, plan.targetCents);
  const monthlyNeeded = computeMonthlySavingsNeeded({
    targetCents: plan.targetCents,
    savedCents: plan.savedCents,
    targetDate: plan.targetDate,
  });

  const subtitle = useMemo(() => {
    const parts = [`Meta até ${formatIsoDateBr(plan.targetDate)}`];
    if (plan.linkedAccountName) {
      parts.push(`Caixinha: ${plan.linkedAccountName}`);
    }
    if (plan.financingName) {
      parts.push(`Financiamento: ${plan.financingName}`);
    }
    return parts.join(' · ');
  }, [plan.targetDate, plan.linkedAccountName, plan.financingName]);

  function handleDelete(): void {
    if (!window.confirm(`Excluir o plano "${plan.name}"?`)) return;
    startTransition(async () => {
      await runWithToast(() => deletePlanAction(plan.id), {
        loading: 'Excluindo…',
        success: 'Plano excluído',
      });
    });
  }

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="space-y-4 border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{plan.name}</h2>
              <Badge variant="secondary">{PLAN_KIND_LABEL[plan.kind]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {formatBrlFromCents(plan.savedCents)} de {formatBrlFromCents(plan.targetCents)}
                </span>
                <span className="tabular-nums">{progress.progressPercent}%</span>
              </div>
              <div className="h-1.5 max-w-md overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    progress.isComplete ? 'bg-emerald-500' : 'bg-primary',
                  )}
                  style={{ width: `${Math.min(100, progress.progressPercent)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:text-right">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:min-w-[8.5rem]">
              <p className="text-[11px] text-muted-foreground">Falta guardar</p>
              <p className="font-semibold tabular-nums">
                {formatBrlFromCents(progress.remainingCents)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:min-w-[8.5rem]">
              <p className="text-[11px] text-muted-foreground">Por mês</p>
              <p className="font-semibold tabular-nums">
                {monthlyNeeded > 0 ? formatBrlFromCents(monthlyNeeded) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {plan.linkedAccountName ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/wealth">Ver caixinha</Link>
            </Button>
          ) : null}
          {plan.canWrite ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={pending}>
              <Trash2 className="size-4" />
              Excluir
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Ocultar' : 'Detalhes'}
            <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-4 p-4 sm:p-5">
          {plan.financingPayoff ? (
            <PlanPayoffSimulator
              balanceCents={plan.financingPayoff.balanceCents}
              system={plan.financingPayoff.system}
              annualRateBps={plan.financingPayoff.annualRateBps}
              installmentAmountCents={plan.financingPayoff.installmentAmountCents}
              amortizationCents={plan.financingPayoff.amortizationCents}
              firstDueOn={plan.financingPayoff.firstDueOn}
              targetDate={plan.targetDate}
            />
          ) : null}
          <PlanItemsTable planId={plan.id} items={plan.items} readOnly={!plan.canWrite} />
        </div>
      ) : null}
    </article>
  );
}
