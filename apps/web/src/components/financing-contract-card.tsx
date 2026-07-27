'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatBrlFromCents, formatIsoDateBr, type AmortizationSystem } from '@tim/domain';
import {
  AmortizeSelectedDialog,
  PayInstallmentsDialog,
  type FinancingInstallmentRow,
} from '@/components/installment-pay-dialogs';
import { RebuildFinancingDialog } from '@/components/rebuild-financing-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const SYSTEM_LABEL: Record<AmortizationSystem, string> = {
  price: 'Price',
  sac: 'SAC',
  fixed: 'Fixo',
};

export type { FinancingInstallmentRow };

export function FinancingContractCard({
  financingId,
  name,
  institution,
  system,
  rateLabel,
  installmentCount,
  principalCents,
  installmentAmountCents,
  annualRateBps,
  firstDueOn,
  pendingCount,
  remainingCents,
  amortizeCents,
  paidCents,
  progress,
  nextPending,
  categories,
  installments,
}: {
  financingId: string;
  name: string;
  institution: string | null;
  system: AmortizationSystem;
  rateLabel: string;
  installmentCount: number;
  principalCents: number;
  installmentAmountCents: number;
  annualRateBps: number | null;
  firstDueOn: string;
  pendingCount: number;
  remainingCents: number;
  amortizeCents: number;
  paidCents: number;
  progress: number;
  nextPending: FinancingInstallmentRow | null;
  categories: Array<{ id: string; name: string }>;
  installments: FinancingInstallmentRow[];
}): React.ReactElement {
  const [showSchedule, setShowSchedule] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payOpen, setPayOpen] = useState(false);
  const [amortizeOpen, setAmortizeOpen] = useState(false);
  const paidCount = installmentCount - pendingCount;

  const pendingInstallments = useMemo(
    () => installments.filter((item) => item.status === 'pending'),
    [installments],
  );

  const selectedPending = useMemo(
    () => pendingInstallments.filter((item) => selectedIds.has(item.id)),
    [pendingInstallments, selectedIds],
  );

  const selectedFutures = useMemo(
    () => selectedPending.filter((item) => nextPending != null && item.id !== nextPending.id),
    [selectedPending, nextPending],
  );

  const canPay = selectedPending.length > 0 && categories.length > 0;
  const canAmortize = nextPending != null && selectedFutures.length > 0 && categories.length > 0;

  function toggleId(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllPending(): void {
    setSelectedIds((prev) => {
      if (prev.size === pendingInstallments.length) return new Set();
      return new Set(pendingInstallments.map((item) => item.id));
    });
  }

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="space-y-4 border-b p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
              <Badge variant="secondary">{SYSTEM_LABEL[system]}</Badge>
              <RebuildFinancingDialog
                financing={{
                  id: financingId,
                  name,
                  institution,
                  system,
                  principalCents,
                  installmentCount,
                  installmentAmountCents,
                  annualRateBps,
                  firstDueOn,
                  paidCount,
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {institution || 'Sem instituição'} · {rateLabel} · {installmentCount}x · principal{' '}
              {formatBrlFromCents(principalCents)}
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {paidCount} de {installmentCount} pagas
                </span>
                <span className="tabular-nums">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 max-w-md overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:text-right">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:min-w-[8.5rem]">
              <p className="text-[11px] text-muted-foreground">Restante</p>
              <p className="font-semibold tabular-nums">{formatBrlFromCents(remainingCents)}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {pendingCount} parcela{pendingCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:min-w-[8.5rem]">
              <p className="text-[11px] text-muted-foreground">Se amortizar</p>
              <p className="font-semibold tabular-nums">{formatBrlFromCents(amortizeCents)}</p>
              <p className="text-[11px] text-muted-foreground">
                {remainingCents > amortizeCents
                  ? `evita ${formatBrlFromCents(remainingCents - amortizeCents)}`
                  : 'só principal'}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:min-w-[8.5rem]">
              <p className="text-[11px] text-muted-foreground">Já pago</p>
              <p className="font-semibold tabular-nums">{formatBrlFromCents(paidCents)}</p>
            </div>
          </div>
        </div>

        {pendingCount === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
            Contrato quitado — não há parcelas pendentes.
          </p>
        ) : nextPending ? (
          <p className="text-sm text-muted-foreground">
            Próxima: #{nextPending.number} · {formatIsoDateBr(nextPending.dueOn)} ·{' '}
            {formatBrlFromCents(nextPending.amountCents)}. Selecione parcelas para pagar (com valor
            editável) ou amortizar.
          </p>
        ) : null}
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-muted-foreground"
            onClick={() => setShowSchedule((open) => !open)}
          >
            <ChevronDown
              className={cn(
                'size-4 transition-transform',
                showSchedule ? 'rotate-0' : '-rotate-90',
              )}
            />
            {showSchedule ? 'Ocultar cronograma' : 'Ver cronograma'}
            <span className="tabular-nums">({installments.length})</span>
          </Button>

          {showSchedule && pendingInstallments.length > 0 ? (
            <div className="ml-auto flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={toggleAllPending}>
                {selectedIds.size === pendingInstallments.length
                  ? 'Limpar seleção'
                  : 'Selecionar pendentes'}
              </Button>
              <Button type="button" size="sm" disabled={!canPay} onClick={() => setPayOpen(true)}>
                Pagar{selectedPending.length > 0 ? ` (${selectedPending.length})` : ''}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canAmortize}
                onClick={() => setAmortizeOpen(true)}
              >
                Amortizar{selectedFutures.length > 0 ? ` (${selectedFutures.length})` : ''}
              </Button>
            </div>
          ) : null}
        </div>

        {showSchedule ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">Selecionar</span>
                  </TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Parcela</TableHead>
                  <TableHead className="text-right">Juros</TableHead>
                  <TableHead className="text-right">Amortização</TableHead>
                  <TableHead className="text-right">Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((item) => {
                  const isNext = nextPending?.id === item.id;
                  const isPending = item.status === 'pending';

                  return (
                    <TableRow key={item.id} className={isNext ? 'bg-muted/40' : undefined}>
                      <TableCell>
                        {isPending ? (
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleId(item.id)}
                            aria-label={`Selecionar parcela ${item.number}`}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">{item.number}</TableCell>
                      <TableCell className="tabular-nums">{formatIsoDateBr(item.dueOn)}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'paid' ? 'secondary' : 'outline'}>
                          {item.status === 'paid'
                            ? 'paga'
                            : item.status === 'skipped'
                              ? 'ignorada'
                              : isNext
                                ? 'mês atual'
                                : 'pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBrlFromCents(item.amountCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatBrlFromCents(item.interestCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBrlFromCents(item.principalCents)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {item.paidOn ? formatIsoDateBr(item.paidOn) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      {canPay && payOpen ? (
        <PayInstallmentsDialog
          open={payOpen}
          onOpenChange={(open) => {
            setPayOpen(open);
            if (!open) setSelectedIds(new Set());
          }}
          installments={selectedPending}
          categories={categories}
        />
      ) : null}

      {canAmortize && nextPending && amortizeOpen ? (
        <AmortizeSelectedDialog
          open={amortizeOpen}
          onOpenChange={(open) => {
            setAmortizeOpen(open);
            if (!open) setSelectedIds(new Set());
          }}
          currentMonth={nextPending}
          futures={selectedFutures}
          categories={categories}
        />
      ) : null}
    </article>
  );
}
