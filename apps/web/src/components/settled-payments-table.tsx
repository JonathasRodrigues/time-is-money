'use client';

import {
  formatBrlFromCents,
  formatIsoDateBr,
  PAYABLE_KIND_LABEL,
  type PayableKind,
} from '@tim/domain';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface SettledPaymentRow {
  id: string;
  dueOn: string | null;
  paidOn: string | null;
  description: string | null;
  kind: PayableKind;
  costCenterName: string;
  categoryName: string;
  accountName: string;
  paymentMethodLabel: string;
  amountCents: number;
}

export function SettledPaymentsTable({
  rows,
  mode = 'pay',
}: {
  rows: SettledPaymentRow[];
  mode?: 'pay' | 'receive';
}): React.ReactElement {
  const isReceive = mode === 'receive';
  const dateLabel = isReceive ? 'Recebido em' : 'Pago em';
  const emptyLabel = isReceive
    ? 'Nenhum recebimento neste período.'
    : 'Nenhum pagamento neste período.';

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>{dateLabel}</TableHead>
            <TableHead>{isReceive ? 'Conta' : 'Forma'}</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {row.description?.trim() || row.categoryName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.costCenterName}
                      {row.dueOn ? ` · venc. ${formatIsoDateBr(row.dueOn)}` : ''}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{PAYABLE_KIND_LABEL[row.kind]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.categoryName}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.paidOn ? formatIsoDateBr(row.paidOn) : '—'}
                </TableCell>
                <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                  {isReceive ? row.accountName : row.paymentMethodLabel}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatBrlFromCents(row.amountCents)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
