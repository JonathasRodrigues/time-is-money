import { describe, expect, it } from 'vitest';
import {
  dueOnForMonth,
  estimatePayableCents,
  resolvePayableKind,
  shiftYearMonth,
  shouldPromptIncomeReceipt,
  shouldPromptPendingIncomes,
  suggestAverageAmountCents,
  transactionStatusLabel,
} from './payments';

describe('payments domain', () => {
  it('classifica fixa, variável e parcela', () => {
    expect(resolvePayableKind({ seriesId: 's', installmentId: null })).toBe('fixed');
    expect(resolvePayableKind({ seriesId: null, installmentId: 'i' })).toBe('installment');
    expect(resolvePayableKind({ seriesId: null, installmentId: null })).toBe('variable');
  });

  it('calcula dueOn no mês', () => {
    expect(dueOnForMonth('2026-02', 28)).toBe('2026-02-28');
    expect(dueOnForMonth('2026-07', 10)).toBe('2026-07-10');
  });

  it('sugere média e estima valor', () => {
    expect(suggestAverageAmountCents([100, 200, 300])).toBe(200);
    expect(suggestAverageAmountCents([])).toBeNull();
    expect(estimatePayableCents({ amountCents: 50, suggestedCents: 90 })).toBe(50);
    expect(estimatePayableCents({ amountCents: null, suggestedCents: 90 })).toBe(90);
  });

  it('desloca yearMonth', () => {
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
  });

  it('prompta recebimento a partir do dia configurado', () => {
    expect(
      shouldPromptIncomeReceipt({
        incomeDay: 5,
        lastConfirmedMonth: null,
        todayIso: '2026-07-05',
      }),
    ).toBe(true);
    expect(
      shouldPromptIncomeReceipt({
        incomeDay: 5,
        lastConfirmedMonth: null,
        todayIso: '2026-07-04',
      }),
    ).toBe(false);
    expect(
      shouldPromptIncomeReceipt({
        incomeDay: 5,
        lastConfirmedMonth: '2026-07',
        todayIso: '2026-07-10',
      }),
    ).toBe(false);
  });

  it('prompta receitas pendentes da série no mês', () => {
    expect(
      shouldPromptPendingIncomes({
        pendingCount: 2,
        todayIso: '2026-07-01',
      }),
    ).toBe(true);
    expect(
      shouldPromptPendingIncomes({
        pendingCount: 0,
        todayIso: '2026-07-01',
      }),
    ).toBe(false);
    expect(
      shouldPromptPendingIncomes({
        pendingCount: 1,
        snoozedOn: '2026-07-01',
        todayIso: '2026-07-01',
      }),
    ).toBe(false);
  });

  it('rotula status por tipo', () => {
    expect(transactionStatusLabel('expense', 'pending')).toBe('a pagar');
    expect(transactionStatusLabel('expense', 'paid')).toBe('pago');
    expect(transactionStatusLabel('income', 'pending')).toBe('a receber');
    expect(transactionStatusLabel('income', 'paid')).toBe('recebido');
  });
});
