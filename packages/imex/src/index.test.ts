import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  autoMapColumns,
  buildTemplateCsv,
  detectImportFormatFromWorkbook,
  extractYearFromFilename,
  mapContasCategory,
  mapPaymentMethodToAccount,
  mapRows,
  normalizeSettlement,
  parseContasAmountToCents,
  parseContasMonthlyWorkbook,
} from './index';

describe('imex', () => {
  it('builds template csv', () => {
    expect(buildTemplateCsv()).toContain('data;valor;tipo');
  });

  it('auto-maps and validates rows', () => {
    const headers = ['Data', 'Valor', 'Tipo', 'Descricao', 'Categoria'];
    const mapping = autoMapColumns(headers);
    const results = mapRows(
      [
        {
          Data: '01/07/2026',
          Valor: '100,00',
          Tipo: 'despesa',
          Descricao: 'Mercado',
          Categoria: 'Supermercado',
        },
      ],
      mapping,
    );
    expect(results[0]?.status).toBe('ok');
    expect(results[0]?.data?.amountCents).toBe(10000);
    expect(results[0]?.data?.occurredOn).toBe('2026-07-01');
    expect(results[0]?.data?.settlement).toBe('paid');
  });

  it('maps receita a receber via situacao', () => {
    const headers = ['Data', 'Valor', 'Tipo', 'Situacao', 'Descricao'];
    const mapping = autoMapColumns(headers);
    const results = mapRows(
      [
        {
          Data: '05/01/2026',
          Valor: '5.000,00',
          Tipo: 'receita',
          Situacao: 'a receber',
          Descricao: 'Salário',
        },
      ],
      mapping,
    );
    expect(results[0]?.status).toBe('ok');
    expect(results[0]?.data?.type).toBe('income');
    expect(results[0]?.data?.settlement).toBe('pending');
    expect(results[0]?.data?.amountCents).toBe(500000);
  });

  it('normalizes settlement labels', () => {
    expect(normalizeSettlement('pago')).toBe('paid');
    expect(normalizeSettlement('a receber')).toBe('pending');
    expect(normalizeSettlement('pending')).toBe('pending');
    expect(normalizeSettlement(undefined)).toBe('paid');
  });
});

describe('contas monthly', () => {
  it('extracts year from filename', () => {
    expect(extractYearFromFilename('Contas - 2024.xlsx')).toBe(2024);
    expect(extractYearFromFilename('contas_2025.xlsx')).toBe(2025);
    expect(extractYearFromFilename('lancamentos.xlsx')).toBeNull();
  });

  it('parses US and BR amounts', () => {
    expect(parseContasAmountToCents('R$ 3,200.00')).toBe(320000);
    expect(parseContasAmountToCents('R$ 85.99')).toBe(8599);
    expect(parseContasAmountToCents('R$ 3.200,00')).toBe(320000);
    expect(parseContasAmountToCents('100,00')).toBe(10000);
  });

  it('maps Cartão Jooh to Nubank PF Jooh', () => {
    expect(mapPaymentMethodToAccount('Cartão Jooh')).toBe('Nubank PF Jooh');
  });

  it('maps Contas categories and Empresa cost center', () => {
    expect(mapContasCategory('Streamming', undefined)).toEqual({ category: 'Assinaturas' });
    expect(mapContasCategory('Empresa', 'Impostos')).toEqual({
      category: 'Impostos/Taxas',
      costCenter: 'Empresa',
    });
    expect(mapContasCategory(undefined, 'Uber Centro')).toEqual({ category: 'Transporte' });
    expect(mapContasCategory(undefined, 'Algo aleatório')).toEqual({ category: 'Outros' });
  });

  it('detects contas-monthly format and parses month sheets', () => {
    const aoa = [
      ['Fixo', 'Financiamento', 'R$ 3,200.00', 'Débito Automático', 'Moradia'],
      ['Fixo', 'Vivo - Internet', 'R$ 85.99', 'Débito Automático', 'Moradia'],
      ['Variável', 'Uber', 'R$ 31.83', 'Cartão Jooh', ''],
      ['Variável', 'Amazon Prime', 'R$ 14.90', 'Cartão Jooh', 'Streamming'],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['x']]), 'Resumo');
    XLSX.utils.book_append_sheet(workbook, sheet, 'Janeiro');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Fevereiro');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), 'Março');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Mês']]), 'Receita');

    expect(detectImportFormatFromWorkbook(workbook)).toBe('contas-monthly');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const results = parseContasMonthlyWorkbook(buffer, 2024);

    const jan = results.filter((r) => r.data?.occurredOn === '2024-01-10');
    expect(jan.length).toBe(4);

    const financing = jan.find((r) => r.data?.description === 'Financiamento');
    expect(financing?.status).toBe('skip');
    expect(financing?.reason).toMatch(/Financiamento/);

    const vivo = jan.find((r) => r.data?.description === 'Vivo - Internet');
    expect(vivo?.status).toBe('ok');
    expect(vivo?.data?.amountCents).toBe(8599);
    expect(vivo?.data?.category).toBe('Moradia');
    expect(vivo?.data?.tags).toEqual(['fixo']);

    const uber = jan.find((r) => r.data?.description === 'Uber');
    expect(uber?.data?.category).toBe('Transporte');
    expect(uber?.data?.account).toBe('Nubank PF Jooh');
    expect(uber?.data?.paymentMethod).toBe('Cartão Jooh');

    const prime = jan.find((r) => r.data?.description === 'Amazon Prime');
    expect(prime?.data?.category).toBe('Assinaturas');

    // Receita / Resumo ignored — only 3 months × 4 rows
    expect(results).toHaveLength(12);
  });
});
