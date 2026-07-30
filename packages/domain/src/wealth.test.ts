import { describe, expect, it } from 'vitest';
import {
  accountHasSufficientBalance,
  assertAccountDebitBalance,
  assertCardPurchase,
  assertPayInvoice,
  assertTransferAllowed,
  availableCreditCents,
  estimateMonthlyYieldCents,
  formatTransferRouteLabel,
  netWorthCents,
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

  it('valida compra no cartão', () => {
    expect(() => assertCardPurchase({ type: 'income', amountCents: 100 })).toThrow(/despesas/);
    expect(() =>
      assertCardPurchase({ type: 'expense', amountCents: 100, cardArchived: true }),
    ).toThrow(/arquivado/);
    expect(() => assertCardPurchase({ type: 'expense', amountCents: 100 })).not.toThrow();
  });

  it('valida saldo para débito em conta', () => {
    expect(() =>
      assertAccountDebitBalance({
        amountCents: 200,
        accountBalanceCents: 100,
      }),
    ).toThrow(/insuficiente/);

    expect(() =>
      assertAccountDebitBalance({
        amountCents: 200,
        accountBalanceCents: 200,
      }),
    ).not.toThrow();

    expect(accountHasSufficientBalance({ amountCents: 150, accountBalanceCents: 100 })).toBe(false);
    expect(accountHasSufficientBalance({ amountCents: 100, accountBalanceCents: 150 })).toBe(true);
  });

  it('valida pagamento de fatura', () => {
    expect(() =>
      assertPayInvoice({
        amountCents: 200,
        accountBalanceCents: 100,
        invoiceBalanceCents: 500,
      }),
    ).toThrow(/insuficiente/);

    expect(() =>
      assertPayInvoice({
        amountCents: 600,
        accountBalanceCents: 1000,
        invoiceBalanceCents: 500,
      }),
    ).toThrow(/fatura/);

    expect(() =>
      assertPayInvoice({
        amountCents: 200,
        accountBalanceCents: 1000,
        invoiceBalanceCents: 500,
      }),
    ).not.toThrow();
  });

  it('calcula patrimônio líquido e limite disponível', () => {
    expect(netWorthCents({ assetsCents: 10_000, liabilitiesCents: 3_000 })).toBe(7_000);
    expect(
      availableCreditCents({ creditLimitCents: 5_000_00, invoiceBalanceCents: 1_200_00 }),
    ).toBe(3_800_00);
    expect(availableCreditCents({ creditLimitCents: 1_000, invoiceBalanceCents: 2_000 })).toBe(0);
  });
});
