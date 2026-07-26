import { describe, expect, it } from 'vitest';
import {
  assertTransferAllowed,
  estimateMonthlyYieldCents,
  formatTransferRouteLabel,
} from './wealth';

describe('wealth domain', () => {
  it('estima rendimento mensal CDI', () => {
    const cents = estimateMonthlyYieldCents({
      balanceCents: 10_000_00,
      yieldType: 'cdi',
      yieldBps: 10_000,
      cdiAnnualBps: 1200,
    });
    expect(cents).toBeGreaterThan(0);
  });

  it('valida transferência', () => {
    expect(() =>
      assertTransferAllowed({
        fromAccountId: 'a',
        toAccountId: 'a',
        amountCents: 100,
        fromBalanceCents: 500,
      }),
    ).toThrow(/diferentes/);

    expect(() =>
      assertTransferAllowed({
        fromAccountId: 'a',
        toAccountId: 'b',
        amountCents: 600,
        fromBalanceCents: 500,
      }),
    ).toThrow(/insuficiente/);

    expect(() =>
      assertTransferAllowed({
        fromAccountId: 'a',
        toAccountId: 'b',
        amountCents: 100,
        fromBalanceCents: 500,
      }),
    ).not.toThrow();
  });

  it('formata rota da transferência', () => {
    expect(formatTransferRouteLabel('Nubank', 'Viagem')).toBe('Nubank → Viagem');
  });
});
