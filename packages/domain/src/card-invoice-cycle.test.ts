import { describe, expect, it } from 'vitest';
import {
  accountAllowsPaymentRail,
  defaultAllowedPaymentRails,
  formatAccountPaymentMethodLabel,
  formatCreditCardPaymentMethodLabel,
  normalizeAllowedPaymentRails,
  paymentMethodMovesAccountBalance,
  resolveInvoiceCycle,
  shouldCloseInvoice,
} from './card-invoice-cycle';

describe('resolveInvoiceCycle', () => {
  it('compra antes do fechamento entra no ciclo do mês', () => {
    expect(resolveInvoiceCycle({ closingDay: 3, dueDay: 10, purchaseOn: '2026-07-02' })).toEqual({
      closesOn: '2026-07-03',
      dueOn: '2026-07-10',
    });
  });

  it('compra no dia do fechamento ainda entra no ciclo atual', () => {
    expect(resolveInvoiceCycle({ closingDay: 3, dueDay: 10, purchaseOn: '2026-07-03' })).toEqual({
      closesOn: '2026-07-03',
      dueOn: '2026-07-10',
    });
  });

  it('compra após o fechamento cai no próximo ciclo', () => {
    expect(resolveInvoiceCycle({ closingDay: 3, dueDay: 10, purchaseOn: '2026-07-05' })).toEqual({
      closesOn: '2026-08-03',
      dueOn: '2026-08-10',
    });
  });

  it('vencimento no mês seguinte quando dueDay <= closingDay', () => {
    expect(resolveInvoiceCycle({ closingDay: 25, dueDay: 5, purchaseOn: '2026-07-20' })).toEqual({
      closesOn: '2026-07-25',
      dueOn: '2026-08-05',
    });

    expect(resolveInvoiceCycle({ closingDay: 25, dueDay: 5, purchaseOn: '2026-07-26' })).toEqual({
      closesOn: '2026-08-25',
      dueOn: '2026-09-05',
    });
  });
});

describe('shouldCloseInvoice', () => {
  it('fecha open após closesOn', () => {
    expect(
      shouldCloseInvoice({ status: 'open', closesOn: '2026-07-03', todayIso: '2026-07-04' }),
    ).toBe(true);
    expect(
      shouldCloseInvoice({ status: 'open', closesOn: '2026-07-03', todayIso: '2026-07-03' }),
    ).toBe(false);
    expect(
      shouldCloseInvoice({ status: 'closed', closesOn: '2026-07-03', todayIso: '2026-07-10' }),
    ).toBe(false);
  });
});

describe('payment method labels', () => {
  it('formata conta e cartão', () => {
    expect(formatAccountPaymentMethodLabel({ accountName: 'Nubank PF', paymentRail: 'pix' })).toBe(
      'PIX · Nubank PF',
    );
    expect(
      formatAccountPaymentMethodLabel({
        accountName: 'Corrente',
        institutionName: 'Nubank',
        paymentRail: 'ted',
      }),
    ).toBe('TED · Corrente · Nubank');
    expect(
      formatAccountPaymentMethodLabel({
        accountName: 'Nubank PF',
        paymentRail: 'boleto',
      }),
    ).toBe('Boleto · Nubank PF');
    expect(
      formatCreditCardPaymentMethodLabel({
        cardName: 'Ultravioleta',
        lastFour: '4242',
        institutionName: 'Nubank',
      }),
    ).toBe('Crédito · Ultravioleta ·••• 4242 · Nubank');
  });

  it('indica se o método move saldo da conta', () => {
    expect(paymentMethodMovesAccountBalance({ type: 'account', paymentRail: 'pix' })).toBe(true);
    expect(paymentMethodMovesAccountBalance({ type: 'account', paymentRail: 'debit' })).toBe(true);
    expect(paymentMethodMovesAccountBalance({ type: 'account', paymentRail: 'boleto' })).toBe(true);
    expect(paymentMethodMovesAccountBalance({ type: 'credit_card' })).toBe(false);
    expect(paymentMethodMovesAccountBalance({ type: 'account', paymentRail: 'cash' })).toBe(false);
  });

  it('define rails padrão por tipo de conta', () => {
    expect(defaultAllowedPaymentRails('checking')).toEqual(['pix', 'debit', 'ted', 'boleto']);
    expect(defaultAllowedPaymentRails('investment_pot')).toEqual([]);
  });

  it('normaliza e valida rails permitidos', () => {
    expect(normalizeAllowedPaymentRails(['pix', 'pix', 'cash', 'ted'])).toEqual(['pix', 'ted']);
    expect(accountAllowsPaymentRail(['pix'], 'pix')).toBe(true);
    expect(accountAllowsPaymentRail(['pix'], 'debit')).toBe(false);
    expect(accountAllowsPaymentRail([], 'pix')).toBe(false);
  });
});
