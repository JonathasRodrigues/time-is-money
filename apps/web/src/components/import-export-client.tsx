'use client';

import { useMemo, useState, useTransition } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  commitImportAction,
  downloadTemplateAction,
  exportTransactionsAction,
  previewImportAction,
  updateImportPreviewAction,
  type ImportPreviewResult,
  type ImportPreviewRowDto,
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

const PAGE_SIZE = 50;

function formatCentsInput(cents: number | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function parseCentsInput(raw: string): number | null {
  const cleaned = raw.replace(/[R$\s]/gi, '').trim();
  if (!cleaned) return null;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized: string;
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    normalized =
      lastDot > lastComma
        ? cleaned.replace(/,/g, '')
        : cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned;
  }
  const value = Number(normalized);
  if (Number.isNaN(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function countByStatus(rows: ImportPreviewRowDto[]): {
  ok: number;
  error: number;
  skip: number;
} {
  return {
    ok: rows.filter((r) => r.status === 'ok').length,
    error: rows.filter((r) => r.status === 'error').length,
    skip: rows.filter((r) => r.status === 'skip').length,
  };
}

function shiftYearOnRows(rows: ImportPreviewRowDto[], year: number): ImportPreviewRowDto[] {
  return rows.map((row) => {
    if (!row.occurredOn || row.occurredOn.length < 10) return row;
    return { ...row, occurredOn: `${year}${row.occurredOn.slice(4)}` };
  });
}

export function ImportExportClient(): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [rows, setRows] = useState<ImportPreviewRowDto[]>([]);
  /** method (bruto) → nome da conta do household */
  const [methodMap, setMethodMap] = useState<Record<string, string>>({});
  const [year, setYear] = useState<string>('');
  const [page, setPage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'ok' | 'skip' | 'error'>('all');

  const counts = useMemo(() => countByStatus(rows), [rows]);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const unmappedMethods = useMemo(() => {
    if (!preview?.paymentMethods.length) return [];
    return preview.paymentMethods.filter((m) => !methodMap[m.method]?.trim());
  }, [preview, methodMap]);

  function patchRow(id: string, patch: Partial<ImportPreviewRowDto>): void {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  function applyYear(nextYear: number): void {
    setYear(String(nextYear));
    setRows((prev) => shiftYearOnRows(prev, nextYear));
    setDirty(true);
  }

  function applyMethodAccount(method: string, accountName: string): void {
    setMethodMap((prev) => ({ ...prev, [method]: accountName }));
    setRows((prev) =>
      prev.map((row) => {
        const rowMethod = row.paymentMethod ?? '';
        if (rowMethod !== method) return row;
        return { ...row, account: accountName || undefined };
      }),
    );
    setDirty(true);
  }

  function rowsToUpdatePayload() {
    return rows.flatMap((row) => {
      if (!row.occurredOn || !row.amountCents || !row.type) return [];
      return [
        {
          id: row.id,
          status: row.status,
          occurredOn: row.occurredOn,
          amountCents: row.amountCents,
          type: row.type,
          description: row.description ?? null,
          category: row.category ?? null,
          costCenter: row.costCenter ?? null,
          account: row.account ?? null,
          paymentMethod: row.paymentMethod ?? null,
          tags: row.tags,
          reason: row.reason ?? null,
        },
      ];
    });
  }

  function initPreview(result: ImportPreviewResult): void {
    const initial: Record<string, string> = {};
    for (const m of result.paymentMethods) {
      initial[m.method] = m.matchedAccount ?? '';
    }
    const mappedRows = result.rows.map((row) => {
      const method = row.paymentMethod ?? '';
      const matched = result.paymentMethods.find((m) => m.method === method)?.matchedAccount;
      if (!matched) return row;
      return { ...row, account: matched };
    });
    setPreview(result);
    setRows(mappedRows);
    setMethodMap(initial);
    setYear(result.year ? String(result.year) : '');
    setPage(0);
    setDirty(result.paymentMethods.some((m) => Boolean(m.matchedAccount)));
    setFilter('all');
    setMessage(
      `Preview: ${result.ok} ok, ${result.skip} skip, ${result.error} erros (${result.importFormat})`,
    );
  }

  return (
    <div className="grid gap-6">
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
            <CardDescription>
              Template flat ou planilha Contas (abas mensais). Revise antes de gravar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  try {
                    const result = await previewImportAction(fd);
                    initPreview(result);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : 'Falha no preview');
                  }
                });
              }}
            >
              <Input name="file" type="file" accept=".csv,.xlsx" required />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="year">Ano (Contas — opcional se estiver no nome do arquivo)</Label>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  min={2000}
                  max={2100}
                  placeholder="2024"
                />
              </div>
              <Button type="submit" disabled={pending}>
                Pré-visualizar
              </Button>
            </form>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </CardContent>
        </Card>
      </div>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Revisão da importação</CardTitle>
            <CardDescription>
              {preview.fileName}
              {preview.importFormat === 'contas-monthly'
                ? ' — formato Contas (abas mensais). Ajuste linhas antes de confirmar.'
                : ' — template flat. Ajuste linhas antes de confirmar.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{counts.ok} ok</Badge>
                <Badge variant="outline">{counts.skip} skip</Badge>
                <Badge variant="outline">{counts.error} erros</Badge>
                {dirty ? <Badge variant="destructive">alterações não salvas</Badge> : null}
                {unmappedMethods.length > 0 ? (
                  <Badge variant="destructive">{unmappedMethods.length} métodos sem conta</Badge>
                ) : null}
              </div>
              <div className="ml-auto flex flex-wrap items-end gap-3">
                {preview.importFormat === 'contas-monthly' ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="review-year">Ano das datas</Label>
                    <Input
                      id="review-year"
                      type="number"
                      min={2000}
                      max={2100}
                      className="w-28"
                      value={year}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isInteger(next) && next >= 2000 && next <= 2100) {
                          applyYear(next);
                        } else {
                          setYear(e.target.value);
                        }
                      }}
                    />
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="filter">Filtro</Label>
                  <select
                    id="filter"
                    className={nativeSelectClassName}
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value as typeof filter);
                      setPage(0);
                    }}
                  >
                    <option value="all">Todas</option>
                    <option value="ok">Ok</option>
                    <option value="skip">Skip</option>
                    <option value="error">Erro</option>
                  </select>
                </div>
              </div>
            </div>

            {preview.paymentMethods.length > 0 ? (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">Mapear métodos de pagamento → contas</p>
                  <p className="text-xs text-muted-foreground">
                    Escolha a conta do household equivalente a cada método da planilha. Aplica em
                    todas as linhas daquele método.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {preview.paymentMethods.map((m) => (
                    <div
                      key={m.method || '(vazio)'}
                      className="flex flex-col gap-1.5 rounded-md border bg-background p-2"
                    >
                      <Label className="text-xs">
                        <span className="font-medium">{m.method || '(sem método)'}</span>{' '}
                        <span className="text-muted-foreground">· {m.count} linhas</span>
                      </Label>
                      <select
                        className={nativeSelectClassName}
                        value={methodMap[m.method] ?? ''}
                        onChange={(e) => applyMethodAccount(m.method, e.target.value)}
                      >
                        <option value="">Escolher conta…</option>
                        {preview.options.accounts.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      {m.suggestedAccount && !m.matchedAccount ? (
                        <span className="text-[11px] text-muted-foreground">
                          Sugestão: {m.suggestedAccount} (crie a conta ou escolha outra)
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Imp.</TableHead>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-28">Valor</TableHead>
                    <TableHead className="min-w-36">Categoria</TableHead>
                    <TableHead className="min-w-36">Conta</TableHead>
                    <TableHead className="min-w-36">Centro</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={row.status === 'skip' ? 'opacity-60' : undefined}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={row.status === 'ok'}
                          disabled={row.status === 'error' && !row.occurredOn}
                          onChange={(e) => {
                            patchRow(row.id, {
                              status: e.target.checked ? 'ok' : 'skip',
                              reason: e.target.checked
                                ? null
                                : (row.reason ?? 'Ignorado pelo usuário'),
                            });
                          }}
                          aria-label={`Importar linha ${row.rowNumber}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className="h-8 min-w-32"
                          value={row.occurredOn ?? ''}
                          onChange={(e) => patchRow(row.id, { occurredOn: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 min-w-40"
                          value={row.description ?? ''}
                          onChange={(e) => patchRow(row.id, { description: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 tabular-nums"
                          value={formatCentsInput(row.amountCents)}
                          onChange={(e) => {
                            const cents = parseCentsInput(e.target.value);
                            if (cents != null) patchRow(row.id, { amountCents: cents });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className={nativeSelectClassName}
                          value={row.category ?? ''}
                          onChange={(e) =>
                            patchRow(row.id, { category: e.target.value || undefined })
                          }
                        >
                          <option value="">—</option>
                          {preview.options.categories
                            .filter((c) => !c.type || c.type === (row.type ?? 'expense'))
                            .map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          {row.category &&
                          !preview.options.categories.some((c) => c.name === row.category) ? (
                            <option value={row.category}>{row.category} (planilha)</option>
                          ) : null}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          className={nativeSelectClassName}
                          value={row.account ?? ''}
                          onChange={(e) =>
                            patchRow(row.id, { account: e.target.value || undefined })
                          }
                        >
                          <option value="">—</option>
                          {preview.options.accounts.map((a) => (
                            <option key={a.id} value={a.name}>
                              {a.name}
                            </option>
                          ))}
                          {row.account &&
                          !preview.options.accounts.some((a) => a.name === row.account) ? (
                            <option value={row.account}>{row.account} (sugerido)</option>
                          ) : null}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          className={nativeSelectClassName}
                          value={row.costCenter ?? ''}
                          onChange={(e) =>
                            patchRow(row.id, { costCenter: e.target.value || undefined })
                          }
                        >
                          <option value="">padrão</option>
                          {preview.options.costCenters.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant={row.status === 'ok' ? 'secondary' : 'outline'}>
                            {row.status}
                          </Badge>
                          {row.reason ? (
                            <span className="max-w-40 truncate text-xs text-muted-foreground">
                              {row.reason}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <span>
                  Página {page + 1} / {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Próxima
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || !dirty}
                  onClick={() => {
                    if (!preview) return;
                    startTransition(async () => {
                      await updateImportPreviewAction({
                        jobId: preview.jobId,
                        rows: rowsToUpdatePayload(),
                      });
                      setDirty(false);
                      setMessage('Ajustes salvos no preview');
                    });
                  }}
                >
                  Salvar ajustes
                </Button>
                <Button
                  type="button"
                  disabled={pending || counts.ok === 0}
                  onClick={() => {
                    if (!preview) return;
                    if (unmappedMethods.length > 0) {
                      setMessage(
                        `Mapeie todos os métodos de pagamento antes de confirmar (${unmappedMethods
                          .map((m) => m.method || '(sem método)')
                          .join(', ')})`,
                      );
                      return;
                    }
                    startTransition(async () => {
                      if (dirty) {
                        await updateImportPreviewAction({
                          jobId: preview.jobId,
                          rows: rowsToUpdatePayload(),
                        });
                        setDirty(false);
                      }
                      const result = await commitImportAction(preview.jobId);
                      setMessage(
                        `Importação concluída: ${result.created} criados, ${result.skipped} skip, ${result.errors} erros`,
                      );
                      setPreview(null);
                      setRows([]);
                      setMethodMap({});
                    });
                  }}
                >
                  Confirmar importação
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
