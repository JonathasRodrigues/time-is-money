'use client';

import { useState, useTransition } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  commitImportAction,
  downloadTemplateAction,
  exportTransactionsAction,
  previewImportAction,
} from '@/server/imex-actions';
import { nativeSelectClassName } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ImportExportClient(): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{
    jobId: string;
    ok: number;
    error: number;
    sample: Array<{ rowNumber: number; status: string; reason?: string }>;
  } | null>(null);
  const [message, setMessage] = useState('');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4 text-primary" />
            Exportar
          </CardTitle>
          <CardDescription>Baixe lançamentos em CSV ou XLSX</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const result = await exportTransactionsAction({
                  format: String(fd.get('format') || 'csv') as 'csv' | 'xlsx',
                  from: String(fd.get('from') || ''),
                  to: String(fd.get('to') || ''),
                });
                const blob = new Blob(
                  [Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))],
                  {
                    type:
                      result.format === 'csv'
                        ? 'text/csv;charset=utf-8'
                        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename;
                a.click();
                URL.revokeObjectURL(url);
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="from">De</Label>
                <Input id="from" name="from" type="date" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="to">Até</Label>
                <Input id="to" name="to" type="date" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="format">Formato</Label>
              <select
                id="format"
                name="format"
                className={nativeSelectClassName}
                defaultValue="csv"
              >
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
              </select>
            </div>
            <Button type="submit" disabled={pending}>
              Baixar export
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await downloadTemplateAction();
                const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'template-time-is-money.csv';
                a.click();
                URL.revokeObjectURL(url);
              });
            }}
          >
            Baixar template oficial
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            Importar
          </CardTitle>
          <CardDescription>Preview antes de gravar — sem surpresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const result = await previewImportAction(fd);
                setPreview(result);
                setMessage(`Preview: ${result.ok} ok, ${result.error} erros`);
              });
            }}
          >
            <Input name="file" type="file" accept=".csv,.xlsx" required />
            <Button type="submit" disabled={pending}>
              Pré-visualizar
            </Button>
          </form>

          {preview ? (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{preview.ok} ok</Badge>
                <Badge variant="outline">{preview.error} erros</Badge>
                {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.sample.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell className="tabular-nums">{row.rowNumber}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'ok' ? 'secondary' : 'outline'}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.reason ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button
                type="button"
                disabled={pending || preview.ok === 0}
                onClick={() => {
                  startTransition(async () => {
                    const result = await commitImportAction(preview.jobId);
                    setMessage(
                      `Importação concluída: ${result.created} criados, ${result.skipped} skip, ${result.errors} erros`,
                    );
                  });
                }}
              >
                Confirmar importação
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
