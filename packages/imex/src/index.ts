import type { ImportColumnMapping } from '@tim/validators';
import { importColumnMappingSchema } from '@tim/validators';
import * as XLSX from 'xlsx';
import { parsedImportRowSchema, type ImportRowResult } from './types';

export type { ImportRowResult, ParsedImportRow } from './types';
export { parsedImportRowSchema } from './types';

export const TEMPLATE_HEADERS = [
  'data',
  'valor',
  'tipo',
  'situacao',
  'descricao',
  'categoria',
  'centro_custo',
  'conta',
] as const;

export type TemplateHeader = (typeof TEMPLATE_HEADERS)[number];

export {
  detectImportFormat,
  detectImportFormatFromWorkbook,
  extractYearFromFilename,
  isMonthSheetName,
  mapContasCategory,
  mapPaymentMethodToAccount,
  monthNumberFromSheetName,
  parseContasAmountToCents,
  parseContasMonthlyWorkbook,
  shiftContasYear,
  type ImportFormat,
} from './contas';

function detectDelimiter(sample: string): ',' | ';' {
  const commas = (sample.match(/,/g) ?? []).length;
  const semis = (sample.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

function parseAmountToCents(raw: string): number {
  const cleaned = raw
    .replace(/[R$\s]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = Number(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Valor inválido: ${raw}`);
  }
  return Math.round(Math.abs(value) * 100);
}

function normalizeType(raw: string | undefined, amountRaw: string): 'income' | 'expense' {
  if (raw) {
    const n = raw.toLowerCase();
    if (n.includes('receita') || n.includes('income') || n === 'r') return 'income';
    if (n.includes('despesa') || n.includes('expense') || n === 'd') return 'expense';
  }
  if (amountRaw.trim().startsWith('-')) return 'expense';
  return 'expense';
}

/** pago / a receber / a pagar → paid | pending. Default paid (extrato). */
export function normalizeSettlement(raw: string | undefined): 'paid' | 'pending' {
  if (!raw?.trim()) return 'paid';
  const n = raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  if (
    n.includes('receber') ||
    n.includes('pagar') ||
    n.includes('pendente') ||
    n === 'pending' ||
    n === 'aberto' ||
    n === 'a receber' ||
    n === 'a pagar'
  ) {
    return 'pending';
  }
  if (n.includes('pago') || n.includes('recebido') || n === 'paid' || n === 'quitado') {
    return 'paid';
  }
  return 'paid';
}

function normalizeDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }
  throw new Error(`Data inválida: ${raw}`);
}

export function parseSpreadsheet(
  buffer: ArrayBuffer | Buffer,
  format: 'csv' | 'xlsx',
): { headers: string[]; rows: Record<string, string>[] } {
  const workbook =
    format === 'csv'
      ? XLSX.read(buffer, { type: 'buffer', raw: false, FS: detectDelimiter(buffer.toString()) })
      : XLSX.read(buffer, { type: 'buffer' });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Planilha vazia');
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('Aba não encontrada');
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  const headers = json.length > 0 ? Object.keys(json[0] ?? {}) : [...TEMPLATE_HEADERS];
  const rows = json.map((row) => {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      mapped[key] = String(value ?? '');
    }
    return mapped;
  });

  return { headers, rows };
}

export function autoMapColumns(headers: string[]): ImportColumnMapping {
  const find = (...candidates: string[]) => {
    const hit = headers.find((h) =>
      candidates.some((c) => h.toLowerCase().includes(c.toLowerCase())),
    );
    return hit;
  };

  return importColumnMappingSchema.parse({
    occurredOn: find('data', 'date', 'occurred') ?? headers[0] ?? 'data',
    amount: find('valor', 'amount', 'value') ?? headers[1] ?? 'valor',
    type: find('tipo', 'type'),
    settlement: find('situacao', 'situação', 'status', 'settlement'),
    description: find('descricao', 'descrição', 'description', 'memo'),
    category: find('categoria', 'category'),
    costCenter: find('centro', 'cost'),
    account: find('conta', 'account'),
  });
}

export function mapRows(
  rows: Record<string, string>[],
  mapping: ImportColumnMapping,
): ImportRowResult[] {
  return rows.map((row, index) => {
    const rowNumber = index + 2;
    try {
      const amountRaw = row[mapping.amount] ?? '';
      const typeRaw = mapping.type ? row[mapping.type] : undefined;
      const settlementRaw = mapping.settlement ? row[mapping.settlement] : undefined;
      const parsed = parsedImportRowSchema.parse({
        occurredOn: normalizeDate(row[mapping.occurredOn] ?? ''),
        amountCents: parseAmountToCents(amountRaw),
        type: normalizeType(typeRaw, amountRaw),
        settlement: normalizeSettlement(settlementRaw),
        description: mapping.description ? row[mapping.description] || undefined : undefined,
        category: mapping.category ? row[mapping.category] || undefined : undefined,
        costCenter: mapping.costCenter ? row[mapping.costCenter] || undefined : undefined,
        account: mapping.account ? row[mapping.account] || undefined : undefined,
      });
      return { rowNumber, status: 'ok' as const, data: parsed };
    } catch (error) {
      return {
        rowNumber,
        status: 'error' as const,
        reason: error instanceof Error ? error.message : 'Linha inválida',
      };
    }
  });
}

export function buildTemplateCsv(): string {
  const header = TEMPLATE_HEADERS.join(';');
  const expense =
    '2026-07-01;100,00;despesa;pago;Supermercado;Supermercado;Pessoa Física;Carteira / Dinheiro';
  const income = '2026-01-05;5000,00;receita;a receber;Salário;Salário;Pessoa Física;Nubank PF';
  return `${header}\n${expense}\n${income}\n`;
}

export function buildExportCsv(
  rows: Array<{
    occurredOn: string;
    amountCents: number;
    type: 'income' | 'expense';
    description?: string | null;
    category?: string | null;
    costCenter?: string | null;
    account?: string | null;
  }>,
): string {
  const lines = [TEMPLATE_HEADERS.join(';')];
  for (const row of rows) {
    const amount = (row.amountCents / 100).toFixed(2).replace('.', ',');
    lines.push(
      [
        row.occurredOn,
        amount,
        row.type === 'income' ? 'receita' : 'despesa',
        'pago',
        row.description ?? '',
        row.category ?? '',
        row.costCenter ?? '',
        row.account ?? '',
      ].join(';'),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function buildExportXlsx(rows: Parameters<typeof buildExportCsv>[0]): ArrayBuffer {
  const aoa: string[][] = [
    [...TEMPLATE_HEADERS],
    ...rows.map((row) => [
      row.occurredOn,
      (row.amountCents / 100).toFixed(2).replace('.', ','),
      row.type === 'income' ? 'receita' : 'despesa',
      'pago',
      row.description ?? '',
      row.category ?? '',
      row.costCenter ?? '',
      row.account ?? '',
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'lancamentos');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
