'use client';

import { useMemo, useState, useTransition } from 'react';
import { formatBrlFromCents, formatIsoDateBr, PAYABLE_KIND_LABEL } from '@tim/domain';
import type { PayableKind } from '@tim/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { runWithToast, withActionToast } from '@/lib/action-toast';
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

function payAmountCents(row: PayableRow): number | null {
  if (row.amountCents != null && row.amountCents > 0) return row.amountCents;
  if (row.suggestedCents != null && row.suggestedCents > 0) return row.suggestedCents;
  return null;
}

function amountInputDefault(row: PayableRow): string {
  const cents = payAmountCents(row);
  return cents != null ? (cents / 100).toFixed(2) : '';
}

export function PaymentsTable({
  rows,
  today,
}: {
  rows: PayableRow[];
  today: string;
}): React.ReactElement {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();

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

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(selectableIds) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function paySelected() {
    const items = selectedRows
      .map((row) => {
        const amountCents = payAmountCents(row);
        if (amountCents == null) return null;
        return { transactionId: row.id, amountCents };
      })
      .filter((item): item is { transactionId: string; amountCents: number } => item != null);

    if (items.length === 0) return;

    startTransition(async () => {
      try {
        await runWithToast(() => payTransactionsBulkAction({ paidOn: today, items }), {
          loading: `Pagando ${items.length}…`,
          success: items.length === 1 ? 'Pagamento registrado' : 'Pagamentos registrados',
        });
        setSelected(new Set());
      } catch {
        // toast já exibido
      }
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 mx-5">
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setSelected(new Set())}
            >
              Limpar
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={paySelected}>
              {pending ? 'Pagando…' : `Pagar ${selected.size}`}
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
                disabled={selectableIds.length === 0}
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
              return (
                <TableRow key={row.id} data-state={selected.has(row.id) ? 'selected' : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-4 rounded border border-input accent-primary"
                      aria-label={`Selecionar ${row.description ?? 'conta'}`}
                      checked={selected.has(row.id)}
                      disabled={!canSelect}
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
                    <form className="flex flex-wrap items-center justify-end gap-1.5">
                      <input type="hidden" name="transactionId" value={row.id} />
                      <input type="hidden" name="paidOn" value={today} />
                      <Input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Valor"
                        defaultValue={amountInputDefault(row)}
                        className="h-8 w-28"
                      />
                      <SubmitButton
                        size="sm"
                        variant="outline"
                        pendingLabel="…"
                        formAction={withActionToast(updatePendingAmountAction, {
                          loading: 'Salvando valor…',
                          success: 'Valor atualizado',
                        })}
                      >
                        Salvar
                      </SubmitButton>
                      <SubmitButton
                        size="sm"
                        pendingLabel="…"
                        formAction={withActionToast(payTransactionAction, {
                          loading: 'Registrando pagamento…',
                          success: 'Pago',
                        })}
                      >
                        Pagar
                      </SubmitButton>
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
