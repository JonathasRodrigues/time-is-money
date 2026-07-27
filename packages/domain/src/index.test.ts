import { describe, expect, it } from 'vitest';
import {
  addMonths,
  buildInstallmentSchedule,
  formatBrlFromCents,
  formatCentsForBrInput,
  formatIsoDateBr,
  maskBrDateInput,
  parseBrDateToIso,
  parseBrlToCents,
  rebuildRemainingSchedule,
  resolveEntities,
  simulateFixed,
  simulatePrice,
  simulateSac,
} from './index';

describe('domain', () => {
  it('formats BRL from cents', () => {
    expect(formatBrlFromCents(10000)).toContain('100');
  });

  it('formats ISO date as dd/mm/yyyy', () => {
    expect(formatIsoDateBr('2026-07-25')).toBe('25/07/2026');
  });

  it('parses and formats BR money input', () => {
    expect(formatCentsForBrInput(123456)).toBe('1234,56');
    expect(parseBrlToCents('1.234,56')).toBe(123456);
    expect(parseBrlToCents('1234,56')).toBe(123456);
    expect(parseBrlToCents('1234.56')).toBe(123456);
    expect(parseBrlToCents('')).toBeNull();
  });

  it('parses BR dates and masks input', () => {
    expect(parseBrDateToIso('25/07/2026')).toBe('2026-07-25');
    expect(parseBrDateToIso('31/02/2026')).toBeNull();
    expect(maskBrDateInput('25072026')).toBe('25/07/2026');
    expect(maskBrDateInput('2507')).toBe('25/07');
  });

  it('adds months without day overflow', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('builds installment schedule', () => {
    const schedule = buildInstallmentSchedule({
      firstDueOn: '2026-01-10',
      installmentCount: 3,
      installmentAmountCents: 50000,
    });
    expect(schedule).toHaveLength(3);
    expect(schedule[2]?.dueOn).toBe('2026-03-10');
  });

  it('simulates Price with equal installments and zero final balance', () => {
    const result = simulatePrice({
      principalCents: 10_000_00,
      installmentCount: 12,
      annualRateBps: 1800,
      firstDueOn: '2026-01-15',
    });
    expect(result.system).toBe('price');
    expect(result.schedule).toHaveLength(12);
    expect(
      result.schedule.slice(0, -1).every((row) => row.amountCents === result.firstInstallmentCents),
    ).toBe(true);
    expect(Math.abs(result.lastInstallmentCents - result.firstInstallmentCents)).toBeLessThan(200);
    expect(result.schedule[11]?.balanceAfterCents).toBe(0);
    expect(result.totalInterestCents).toBeGreaterThan(0);
  });

  it('keeps end-of-month due dates on Price schedule', () => {
    const result = simulatePrice({
      principalCents: 10_000_00,
      installmentCount: 3,
      annualRateBps: 1200,
      firstDueOn: '2026-01-31',
    });
    expect(result.schedule.map((row) => row.dueOn)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('simulates fixed installment with interest (not pure amortization)', () => {
    const result = simulateFixed({
      principalCents: 100_000_00,
      installmentCount: 48,
      installmentAmountCents: 3_200_00,
      firstDueOn: '2024-01-10',
    });
    expect(result.system).toBe('fixed');
    expect(result.schedule).toHaveLength(48);
    expect(result.schedule[0]?.amountCents).toBe(3_200_00);
    expect(result.schedule[0]?.interestCents).toBeGreaterThan(0);
    expect(result.schedule[0]?.principalCents).toBeLessThan(3_200_00);
    expect(result.totalInterestCents).toBeGreaterThan(0);
    expect(result.schedule[47]?.balanceAfterCents).toBe(0);
    expect(result.annualRateBps).toBeGreaterThan(0);
  });

  it('simulates SAC with decreasing installments', () => {
    const result = simulateSac({
      principalCents: 12_000_00,
      installmentCount: 12,
      annualRateBps: 1200,
      firstDueOn: '2026-02-01',
    });
    expect(result.system).toBe('sac');
    expect(result.firstInstallmentCents).toBeGreaterThan(result.lastInstallmentCents);
    expect(result.schedule[0]?.principalCents).toBe(result.schedule[1]?.principalCents);
    expect(result.schedule[11]?.balanceAfterCents).toBe(0);
  });

  it('rebuilds Price schedule after extra amortization keeping installment', () => {
    const original = simulatePrice({
      principalCents: 12_000_00,
      installmentCount: 12,
      annualRateBps: 1200,
      firstDueOn: '2026-01-10',
    });
    const afterFirst = original.schedule[0]!;
    const rebuilt = rebuildRemainingSchedule({
      system: 'price',
      balanceCents: afterFirst.balanceAfterCents - 2_000_00,
      firstDueOn: '2026-02-10',
      annualRateBps: 1200,
      installmentAmountCents: original.firstInstallmentCents,
    });
    expect(rebuilt.installmentCount).toBeLessThan(11);
    expect(rebuilt.schedule.at(-1)?.balanceAfterCents).toBe(0);
    expect(rebuilt.schedule[0]?.amountCents).toBe(original.firstInstallmentCents);
  });

  it('resolves category by alias and reports ambiguity', () => {
    const result = resolveEntities(
      { category: 'mercado', costCenter: 'PF' },
      {
        costCenters: [
          { id: '1', name: 'Pessoa Física' },
          { id: '2', name: 'Empresa X' },
        ],
        categories: [
          { id: 'c1', name: 'Supermercado', type: 'expense', aliases: ['mercado'] },
          { id: 'c2', name: 'Mercado Livre', type: 'expense', aliases: ['mercado'] },
        ],
        accounts: [],
      },
    );
    expect(result.categoryId).toBeNull();
    expect(result.ambiguities.some((a) => a.field === 'category')).toBe(true);
  });
});
