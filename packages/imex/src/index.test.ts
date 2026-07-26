import { describe, expect, it } from 'vitest';
import { autoMapColumns, buildTemplateCsv, mapRows } from './index';

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
  });
});
