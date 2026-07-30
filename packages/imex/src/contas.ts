import * as XLSX from 'xlsx';
import type { ImportRowResult, ParsedImportRow } from './types';

export type ImportFormat = 'flat' | 'contas-monthly';

const MONTH_SHEETS: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

/** Mapeia rótulos da planilha Contas → nomes de categoria do TIM. */
const CONTAS_CATEGORY_MAP: Record<string, string> = {
  supermercado: 'Supermercado',
  transporte: 'Transporte',
  restaurante: 'Alimentação',
  comida: 'Alimentação',
  moradia: 'Moradia',
  streamming: 'Assinaturas',
  streaming: 'Assinaturas',
  pet: 'Pessoal',
  pets: 'Pessoal',
  roupas: 'Pessoal',
  roupa: 'Pessoal',
  games: 'Lazer',
  'itens casa': 'Moradia',
  saúde: 'Saúde',
  saude: 'Saúde',
  diversao: 'Lazer',
  diversão: 'Lazer',
  comunicação: 'Assinaturas',
  comunicacao: 'Assinaturas',
  delivery: 'Delivery',
  viagem: 'Lazer',
  entretenimento: 'Lazer',
  eletrônicos: 'Pessoal',
  eletronicos: 'Pessoal',
  eletrônico: 'Pessoal',
  eletronico: 'Pessoal',
  cosméticos: 'Pessoal',
  cosmeticos: 'Pessoal',
  cosmético: 'Pessoal',
  cosmetico: 'Pessoal',
  lazer: 'Lazer',
  outros: 'Outros',
  presentes: 'Pessoal',
  eletrodomestico: 'Moradia',
  eletrodoméstico: 'Moradia',
};

const DESCRIPTION_CATEGORY_HINTS: Array<{ pattern: RegExp; category: string }> = [
  {
    pattern: /\b(uber|99|combust[ií]vel|gasolina|estacionamento|ped[aá]gio|nutag)\b/i,
    category: 'Transporte',
  },
  {
    pattern: /\b(ifood|rappi|delivery|pizza|burger|a[cç]ai|almo[cç]o|jantar)\b/i,
    category: 'Alimentação',
  },
  { pattern: /\b(mercado|supermercado|flash|atacad[aã]o)\b/i, category: 'Supermercado' },
  {
    pattern: /\b(netflix|spotify|prime|disney|hbo|paramount|steam|kindle|max)\b/i,
    category: 'Assinaturas',
  },
  { pattern: /\b(pet|ra[cç][aã]o|veterin[aá]r)/i, category: 'Pessoal' },
  { pattern: /\b(farm[aá]cia|m[eé]dic|plano de sa[uú]de|dentista)\b/i, category: 'Saúde' },
  { pattern: /\b(luz|condom[ií]nio|internet|vivo|aluguel)\b/i, category: 'Moradia' },
  { pattern: /\b(imposto|contador|das|inss|cnpj)\b/i, category: 'Impostos/Taxas' },
];

function normalizeKey(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function extractYearFromFilename(fileName: string): number | null {
  const match = fileName.match(/(?:^|[^\d])(20\d{2})(?:[^\d]|$)/);
  if (!match?.[1]) return null;
  const year = Number(match[1]);
  return year >= 2000 && year <= 2100 ? year : null;
}

export function monthNumberFromSheetName(sheetName: string): string | null {
  const key = normalizeKey(sheetName);
  return MONTH_SHEETS[key] ?? MONTH_SHEETS[sheetName.toLowerCase()] ?? null;
}

export function isMonthSheetName(sheetName: string): boolean {
  return monthNumberFromSheetName(sheetName) !== null;
}

/**
 * Aceita US (`3,200.00`) e BR (`3.200,00` / `100,00`).
 */
export function parseContasAmountToCents(raw: string): number {
  const cleaned = raw.replace(/[R$\s]/gi, '').trim();
  if (!cleaned) {
    throw new Error(`Valor inválido: ${raw}`);
  }

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized: string;
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastDot > lastComma) {
      // US: 3,200.00
      normalized = cleaned.replace(/,/g, '');
    } else {
      // BR: 3.200,00
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    // BR decimal: 100,00
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Só ponto ou inteiro — trata como decimal US / plain number
    normalized = cleaned;
  }

  const value = Number(normalized);
  if (Number.isNaN(value)) {
    throw new Error(`Valor inválido: ${raw}`);
  }
  return Math.round(Math.abs(value) * 100);
}

export function mapPaymentMethodToAccount(method: string | undefined | null): string | undefined {
  if (!method || !method.trim()) return undefined;
  const key = normalizeKey(method);

  if (key.includes('jooh') || key.includes('joo')) return 'Nubank PF Jooh';
  if (key.includes('santander')) return 'Santander';
  if (key.includes('fla') || key.includes('flá')) return 'Cartão Flá';
  if (key.includes('debito automatico') || key.includes('débito automático')) {
    return 'Nubank PF';
  }
  if (key.includes('cartao debito') || key.includes('cartão débito') || key === 'debito') {
    return 'Nubank PF';
  }
  if (key === 'pix') return 'Nubank PF';
  return method.trim();
}

export function mapContasCategory(
  rawCategory: string | undefined | null,
  description: string | undefined,
): { category: string; costCenter?: string } {
  const raw = (rawCategory ?? '').trim();
  if (raw) {
    const key = normalizeKey(raw);
    if (key === 'empresa') {
      const desc = (description ?? '').toLowerCase();
      const isTax = /imposto|das|inss|irrf|tax/.test(desc);
      return {
        category: isTax ? 'Impostos/Taxas' : 'Outros',
        costCenter: 'Empresa',
      };
    }
    const mapped = CONTAS_CATEGORY_MAP[key];
    if (mapped) return { category: mapped };
    return { category: raw };
  }

  if (description) {
    for (const hint of DESCRIPTION_CATEGORY_HINTS) {
      if (hint.pattern.test(description)) {
        return { category: hint.category };
      }
    }
  }

  return { category: 'Outros' };
}

function fixoVariavelTag(tipo: string | undefined): string[] {
  if (!tipo) return [];
  const key = normalizeKey(tipo);
  if (key === 'fixo') return ['fixo'];
  if (key === 'variavel') return ['variavel'];
  return [];
}

export function detectImportFormatFromWorkbook(workbook: XLSX.WorkBook): ImportFormat {
  const monthSheets = workbook.SheetNames.filter(isMonthSheetName);
  if (monthSheets.length >= 3) {
    return 'contas-monthly';
  }
  return 'flat';
}

export function detectImportFormat(
  buffer: ArrayBuffer | Buffer,
  format: 'csv' | 'xlsx',
): ImportFormat {
  if (format === 'csv') return 'flat';
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return detectImportFormatFromWorkbook(workbook);
}

export function parseContasMonthlyWorkbook(
  buffer: ArrayBuffer | Buffer,
  year: number,
): ImportRowResult[] {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Ano inválido: ${year}`);
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const results: ImportRowResult[] = [];
  let rowNumber = 1;

  for (const sheetName of workbook.SheetNames) {
    const month = monthNumberFromSheetName(sheetName);
    if (!month) continue;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
    });

    const occurredOn = `${year}-${month}-10`;

    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const tipo = row[0] != null ? String(row[0]).trim() : '';
      const description = row[1] != null ? String(row[1]).trim() : '';
      const amountRaw = row[2] != null ? String(row[2]).trim() : '';
      const method = row[3] != null ? String(row[3]).trim() : '';
      const categoryRaw = row[4] != null ? String(row[4]).trim() : '';

      if (!tipo && !description && !amountRaw) continue;

      rowNumber += 1;

      if (normalizeKey(description) === 'financiamento') {
        let amountCents = 100;
        try {
          amountCents = Math.max(parseContasAmountToCents(amountRaw), 1);
        } catch {
          // valor só para exibição no preview
        }
        const paymentMethod = method || undefined;
        results.push({
          rowNumber,
          status: 'skip',
          reason: 'Financiamento — cadastrar na plataforma',
          data: {
            occurredOn,
            amountCents,
            type: 'expense',
            settlement: 'paid',
            description,
            category: categoryRaw || 'Moradia',
            account: mapPaymentMethodToAccount(method),
            paymentMethod,
            tags: fixoVariavelTag(tipo),
          },
        });
        continue;
      }

      try {
        const amountCents = parseContasAmountToCents(amountRaw);
        if (amountCents <= 0) {
          results.push({
            rowNumber,
            status: 'error',
            reason: `Valor inválido: ${amountRaw}`,
          });
          continue;
        }

        const { category, costCenter } = mapContasCategory(categoryRaw, description);
        const paymentMethod = method || undefined;
        const data: ParsedImportRow = {
          occurredOn,
          amountCents,
          type: 'expense',
          settlement: 'paid',
          description: description || undefined,
          category,
          costCenter,
          account: mapPaymentMethodToAccount(method),
          paymentMethod,
          tags: fixoVariavelTag(tipo),
        };

        results.push({ rowNumber, status: 'ok', data });
      } catch (error) {
        results.push({
          rowNumber,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Linha inválida',
        });
      }
    }
  }

  return results;
}

export function shiftContasYear(rows: ImportRowResult[], newYear: number): ImportRowResult[] {
  if (!Number.isInteger(newYear) || newYear < 2000 || newYear > 2100) {
    throw new Error(`Ano inválido: ${newYear}`);
  }
  return rows.map((row) => {
    if (!row.data?.occurredOn) return row;
    const rest = row.data.occurredOn.slice(4);
    return {
      ...row,
      data: {
        ...row.data,
        occurredOn: `${newYear}${rest}`,
      },
    };
  });
}
