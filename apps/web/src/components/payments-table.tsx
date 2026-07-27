'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  formatBrlFromCents,
  formatCentsForBrInput,
  formatIsoDateBr,
  PAYABLE_KIND_LABEL,
} from '@tim/domain';
import type { PayableKind } from '@tim/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
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
import { useBusyAction } from '@/hooks/use-busy-action';
import { runWithToast } from '@/lib/action-toast';
import { busySurfaceClassName } from '@/lib/busy-ui';
import {
  payTransactionAction,
  payTransactionsBulkAction,
  updatePendingAmountAction,
} from '@/server/actions';

export interface PayableRow {
  id: string;
  dueOn: string | null;
  description: string | null;
  kind: PayableKind;
  costCenterName: string;
  categoryName: string;
  amountCents: number | null;
  suggestedCents: number | null;
  estimatedCents: number;
}

type BusyKey = 'bulk' | `pay:${string}` | `save:${string}`;

function payAmountCents(row: PayableRow): number | null {
  if (row.amountCents != null && row.amountCents > 0) return row.amountCents;
  if (row.suggestedCents != null && row.suggestedCents > 0) return row.suggestedCents;
  return null;
}

function amountInputDefault(row: PayableRow): string {
  const cents = payAmountCents(row);
  return cents != null ? formatCentsForBrInput(cents) : '';
}

function defaultPaidOn(row: PayableRow, today: string): string {
  return row.dueOn ?? today;
}

export function PaymentsTable({
  rows,
  today,
  mode = 'pay',
}: {
  rows: PayableRow[];
  today: string;
  mode?: 'pay' | 'receive';
}): React.ReactElement {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [paidOns, setPaidOns] = useState<Record<string, string>>({});
  const [applyAllDate, setApplyAllDate] = useState('');
  const { busy, busyKey, isBusy, run } = useBusyAction<BusyKey>();

  const isReceive = mode === 'receive';
  const actionVerb = isReceive ? 'Receber' : 'Pagar';
  const actionGerund = isReceive ? 'Recebendo' : 'Pagando';
  const actionPast = isReceive ? 'Recebido' : 'Pago';
  const dateLabel = isReceive ? 'Recebido em' : 'Pago em';
  const bulkSuccess = isReceive
    ? (count: number) => (count === 1 ? 'Recebimento registrado' : 'Recebimentos registrados')
    : (count: number) => (count === 1 ? 'Pagamento registrado' : 'Pagamentos registrados');

  useEffect(() => {
    setPaidOns((prev) => {
      const next: Record<string, string> = {};
      for (const row of rows) {
        next[row.id] = prev[row.id] ?? defaultPaidOn(row, today);
      }
      return next;
    });
  }, [rows, today]);

  const selectableIds = useMemo(
    () => rows.filter((row) => payAmountCents(row) != null).map((row) => row.id),
    [rows],
  );

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);

  const selectedTotalCents = useMemo(
    () => selectedRows.reduce((sum, row) => sum + (payAmountCents(row) ?? 0), 0),
    [selectedRows],
  );

  const allSelectableChecked =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleAll(checked: boolean): void {
    setSelected(checked ? new Set(selectableIds) : new Set());
  }

  function toggleOne(id: string, checked: boolean): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function applyDateToSelected(): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applyAllDate)) return;
    setPaidOns((prev) => {
      const next = { ...prev };
      for (const row of selectedRows) {
        next[row.id] = applyAllDate;
      }
      return next;
    });
  }

  function paySelected(): void {
    const items = selectedRows
      .map((row) => {
        const amountCents = payAmountCents(row);
        if (amountCents == null) return null;
        const paidOn = paidOns[row.id] ?? defaultPaidOn(row, today);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return null;
        return { transactionId: row.id, amountCents, paidOn };
      })
      .filter(
        (item): item is { transactionId: string; amountCents: number; paidOn: string } =>
          item != null,
      );

    if (items.length === 0) return;

    void run('bulk', async () => {
      try {
        await runWithToast(() => payTransactionsBulkAction({ items }), {
          loading: `${actionGerund} ${items.length}…`,
          success: bulkSuccess(items.length),
        });
        setSelected(new Set());
      } catch {
        // toast já exibido
      }
    });
  }

  function saveRow(rowId: string, form: HTMLFormElement): void {
    const formData = new FormData(form);
    void run(`save:${rowId}`, async () => {
      try {
        await runWithToast(() => updatePendingAmountAction(formData), {
          loading: 'Salvando valor…',
          success: 'Valor atualizado',
        });
      } catch {
        // toast já exibido
      }
    });
  }

  function payRow(rowId: string, form: HTMLFormElement): void {
    const formData = new FormData(form);
    void run(`pay:${rowId}`, async () => {
      try {
        await runWithToast(() => payTransactionAction(formData), {
          loading: isReceive ? 'Registrando recebimento…' : 'Registrando pagamento…',
          success: actionPast,
        });
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      } catch {
        // toast já exibido
      }
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="mx-5 flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <p className="text-sm">
            <span className="font-medium">{selected.size}</span>
            <span className="text-muted-foreground">
              {' '}
              selecionada
              {selected.size === 1 ? '' : 's'} ·{' '}
            </span>
            <span className="font-semibold tabular-nums">
              {formatBrlFromCents(selectedTotalCents)}
            </span>
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="pay-apply-all" className="text-[11px] text-muted-foreground">
                Aplicar {dateLabel.toLowerCase()} em todas
              </Label>
              <div className="flex items-center gap-1.5">
                <DateInput
                  id="pay-apply-all"
                  value={
                    applyAllDate ||
                    (selectedRows[0] ? defaultPaidOn(selectedRows[0], today) : today)
                  }
                  onValueChange={setApplyAllDate}
                  className="h-8 w-[9.5rem]"
                  disabled={busy}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={applyDateToSelected}
                >
                  Aplicar
                </Button>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Limpar
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={paySelected}>
              {busyKey === 'bulk' ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {actionGerund}…
                </>
              ) : (
                `${actionVerb} ${selected.size}`
              )}
            </Button>
          </div>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                className="size-4 rounded border border-input accent-primary"
                aria-label="Selecionar todas"
                checked={allSelectableChecked}
                disabled={selectableIds.length === 0 || busy}
                onChange={(event) => toggleAll(event.target.checked)}
              />
            </TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Centro</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                Nada pendente neste filtro.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const overdue = (row.dueOn ?? '') < today;
              const canSelect = payAmountCents(row) != null;
              const rowPaidOn = paidOns[row.id] ?? defaultPaidOn(row, today);
              const payingThis = isBusy(`pay:${row.id}`);
              const saving = isBusy(`save:${row.id}`);
              const active = payingThis || saving || (busyKey === 'bulk' && selected.has(row.id));

              return (
                <TableRow
                  key={row.id}
                  data-state={selected.has(row.id) ? 'selected' : undefined}
                  aria-busy={active || undefined}
                  className={busySurfaceClassName({ busy, active })}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-4 rounded border border-input accent-primary"
                      aria-label={`Selecionar ${row.description ?? 'conta'}`}
                      checked={selected.has(row.id)}
                      disabled={!canSelect || busy}
                      title={canSelect ? undefined : 'Defina um valor antes de selecionar'}
                      onChange={(event) => toggleOne(row.id, event.target.checked)}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <span className={overdue ? 'text-destructive' : undefined}>
                      {row.dueOn ? formatIsoDateBr(row.dueOn) : '—'}
                    </span>
                    {overdue ? (
                      <Badge variant="destructive" className="ml-2">
                        atraso
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{row.description ?? 'Sem descrição'}</p>
                    <p className="text-xs text-muted-foreground">{row.categoryName}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{PAYABLE_KIND_LABEL[row.kind]}</Badge>
                  </TableCell>
                  <TableCell>{row.costCenterName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.amountCents != null ? (
                      formatBrlFromCents(row.amountCents)
                    ) : (
                      <span className="text-muted-foreground">
                        — · sugestão{' '}
                        {row.suggestedCents != null
                          ? formatBrlFromCents(row.suggestedCents)
                          : 'n/d'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <form
                      className="flex flex-wrap items-end justify-end gap-1.5"
                      onSubmit={(event) => event.preventDefault()}
                    >
                      <input type="hidden" name="transactionId" value={row.id} />
                      <div className="grid gap-0.5">
                        <span className="text-[10px] text-muted-foreground">{dateLabel}</span>
                        <DateInput
                          name="paidOn"
                          value={rowPaidOn}
                          onValueChange={(iso) => {
                            setPaidOns((prev) => ({
                              ...prev,
                              [row.id]: iso || defaultPaidOn(row, today),
                            }));
                          }}
                          className="h-8 w-[9.5rem]"
                          required
                          disabled={busy}
                        />
                      </div>
                      <div className="grid gap-0.5">
                        <span className="text-[10px] text-muted-foreground">Valor</span>
                        <MoneyInput
                          name="amount"
                          min="0"
                          placeholder="Valor"
                          defaultValue={amountInputDefault(row)}
                          className="h-8 w-28"
                          disabled={busy}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={(event) => {
                          const form = event.currentTarget.form;
                          if (form) saveRow(row.id, form);
                        }}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                            Salvando…
                          </>
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={(event) => {
                          const form = event.currentTarget.form;
                          if (form) payRow(row.id, form);
                        }}
                      >
                        {payingThis ? (
                          <>
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                            {actionGerund}…
                          </>
                        ) : (
                          actionVerb
                        )}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
