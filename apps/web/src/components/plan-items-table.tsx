'use client';

import { useState, useTransition } from 'react';
import { formatBrlFromCents, formatCentsForBrInput, parseBrlToCents } from '@tim/domain';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useMutationFeedback } from '@/hooks/use-mutation-feedback';
import { upsertPlanItemsAction } from '@/lib/api/mutations';

export interface PlanItemRow {
  label: string;
  amountCents: number;
}

interface PlanItemsTableProps {
  planId: string;
  items: PlanItemRow[];
  onChange?: (items: PlanItemRow[]) => void;
  readOnly?: boolean;
}

export function PlanItemsTable({
  planId,
  items,
  onChange,
  readOnly = false,
}: PlanItemsTableProps): React.ReactElement {
  const [localItems, setLocalItems] = useState<PlanItemRow[] | null>(null);
  const [pending, startTransition] = useTransition();
  const { run } = useMutationFeedback();

  const rows = onChange != null ? items : (localItems ?? items);
  const totalCents = rows.reduce((sum, item) => sum + item.amountCents, 0);

  function setRows(next: PlanItemRow[]): void {
    if (onChange != null) {
      onChange(next);
      return;
    }
    setLocalItems(next);
  }

  function updateItem(index: number, patch: Partial<PlanItemRow>): void {
    setRows(rows.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem(): void {
    setRows([...rows, { label: '', amountCents: 0 }]);
  }

  function removeItem(index: number): void {
    setRows(rows.filter((_, i) => i !== index));
  }

  function saveItems(): void {
    const valid = rows.filter((item) => item.label.trim() && item.amountCents > 0);
    if (valid.length === 0) return;
    startTransition(async () => {
      await run(
        () =>
          upsertPlanItemsAction({
            planId,
            items: valid.map((item, index) => ({
              label: item.label.trim(),
              amountCents: item.amountCents,
              sortOrder: index,
            })),
          }),
        { loading: 'Salvando itens…', success: 'Itens atualizados', invalidate: 'financing' },
      );
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Itens da meta</p>
        <p className="text-xs text-muted-foreground">
          A soma dos itens define o total do planejamento (ex.: hotel + passagem).
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right w-40">Valor</TableHead>
            {!readOnly ? <TableHead className="w-10" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item, index) => (
            <TableRow key={`${index}-${item.label}`}>
              <TableCell>
                {readOnly ? (
                  item.label
                ) : (
                  <Input
                    value={item.label}
                    onChange={(event) => updateItem(index, { label: event.target.value })}
                    placeholder="Hotel, passagem…"
                  />
                )}
              </TableCell>
              <TableCell className="text-right">
                {readOnly ? (
                  <span className="tabular-nums">{formatBrlFromCents(item.amountCents)}</span>
                ) : (
                  <MoneyInput
                    value={formatCentsForBrInput(item.amountCents)}
                    onValueChange={(raw) => {
                      const cents = parseBrlToCents(raw);
                      updateItem(index, { amountCents: cents ?? 0 });
                    }}
                  />
                )}
              </TableCell>
              {!readOnly ? (
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => removeItem(index)}
                    disabled={rows.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium tabular-nums">Total: {formatBrlFromCents(totalCents)}</p>
        {!readOnly ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              Adicionar item
            </Button>
            <SubmitButton type="button" size="sm" isPending={pending} onClick={saveItems}>
              Salvar itens
            </SubmitButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
