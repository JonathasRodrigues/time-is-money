import { z } from 'zod';
import { isoDateSchema } from '@tim/validators';
import { dateRangeQuerySchema } from './common';

export const paymentsFlowSchema = z.enum(['pay', 'receive']);

export const payableKindSchema = z.enum([
  'fixed',
  'variable',
  'installment',
  'credit_card_invoice',
]);

export const paymentsQuerySchema = dateRangeQuerySchema.extend({
  kind: payableKindSchema.optional(),
  payday: z.enum(['1']).optional(),
  flow: paymentsFlowSchema.optional(),
  /** Filtra obrigações / fatura deste cartão. */
  card: z.string().uuid().optional(),
});

export const invoicePurchaseSchema = z.object({
  id: z.string().uuid(),
  description: z.string().nullable(),
  categoryName: z.string(),
  occurredOn: isoDateSchema.nullable(),
  amountCents: z.number().int(),
});

export const paymentRowSchema = z.object({
  id: z.string().uuid(),
  dueOn: isoDateSchema.nullable(),
  description: z.string().nullable(),
  kind: payableKindSchema,
  costCenterId: z.string().uuid().nullable(),
  costCenterName: z.string(),
  categoryId: z.string().uuid().nullable(),
  categoryName: z.string(),
  accountId: z.string().uuid(),
  amountCents: z.number().int().nullable(),
  /** Meio previsto na quitação (PIX/débito/TED), quando cadastrado. */
  paymentRail: z.enum(['pix', 'debit', 'ted', 'boleto', 'cash', 'other']).nullable(),
  /** Forma de pagamento persistida (FK). */
  paymentMethodId: z.string().uuid().nullable().optional(),
  suggestedCents: z.number().int().nullable(),
  estimatedCents: z.number().int(),
  /**
   * Fatura (filha do cartão): ao pagar, só formas na conta.
   * `id` = credit_card_invoice_id (ou credit_card_id se ainda sem ciclo persistido).
   */
  creditCardId: z.string().uuid().nullable(),
  creditCardInvoiceId: z.string().uuid().nullable(),
  creditCardName: z.string().nullable(),
  /** Quantas compras estão agrupadas nesta fatura (só kind fatura). */
  purchaseCount: z.number().int().nonnegative().nullable(),
  /** Itens da fatura (compras no crédito) — UI agrupa sob a fatura. */
  purchases: z.array(invoicePurchaseSchema).optional(),
});

/** Já pago / já recebido no período (editável: forma, valor, data…). */
export const settledPaymentRowSchema = z.object({
  id: z.string().uuid(),
  dueOn: isoDateSchema.nullable(),
  paidOn: isoDateSchema.nullable(),
  description: z.string().nullable(),
  kind: payableKindSchema,
  costCenterId: z.string().uuid(),
  costCenterName: z.string(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  accountId: z.string().uuid(),
  accountName: z.string(),
  paymentRail: z.enum(['pix', 'debit', 'ted', 'boleto', 'cash', 'other']).nullable(),
  paymentMethodId: z.string().uuid().nullable(),
  paymentMethodLabel: z.string(),
  amountCents: z.number().int(),
});

export const paymentMethodSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['account', 'credit_card']),
  accountId: z.string().uuid().nullable(),
  creditCardId: z.string().uuid().nullable(),
  paymentRail: z.enum(['pix', 'debit', 'ted', 'boleto', 'cash', 'other']).nullable(),
  /** Conta bancária vinculada a esta forma (onde o dinheiro entra/sai). */
  linkedAccountName: z.string().nullable(),
  /** Banco vinculado (via conta ou cartão). */
  linkedInstitutionName: z.string().nullable(),
  /**
   * Conta: saldo atual. Cartão: limite disponível (limite − fatura).
   * Null só quando não aplicável.
   */
  balanceCents: z.number().int().nullable(),
  label: z.string(),
});

export const paymentsResponseSchema = z.object({
  flow: paymentsFlowSchema,
  fromPayday: z.boolean(),
  today: isoDateSchema,
  range: z.object({
    start: isoDateSchema,
    end: isoDateSchema,
    period: z.string(),
    label: z.string(),
  }),
  filters: z.object({
    centerId: z.string().uuid().nullable(),
    kindFilter: payableKindSchema.nullable(),
    creditCardId: z.string().uuid().nullable(),
  }),
  totals: z.object({
    paidTotalCents: z.number().int(),
    knownPendingCents: z.number().int(),
    estimatedGapCents: z.number().int(),
    remainingCents: z.number().int(),
  }),
  /** @deprecated Preferir linhas `kind: credit_card_invoice` em `rows`. */
  cardInvoice: z
    .object({
      creditCardId: z.string().uuid(),
      invoiceId: z.string().uuid().nullable(),
      name: z.string(),
      lastFour: z.string().nullable(),
      invoiceBalanceCents: z.number().int(),
      paymentAccountId: z.string().uuid(),
      dueDay: z.number().int(),
      closesOn: isoDateSchema.nullable(),
      dueOn: isoDateSchema.nullable(),
      status: z.enum(['open', 'closed', 'paid']),
    })
    .nullable(),
  rows: z.array(paymentRowSchema),
  settledRows: z.array(settledPaymentRowSchema),
  lookups: z.object({
    centers: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    expenseCategories: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    incomeCategories: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    sheetAccounts: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    tableAccounts: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    creditCards: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        lastFour: z.string().nullable(),
        paymentAccountId: z.string().uuid(),
      }),
    ),
    paymentMethods: z.array(paymentMethodSchema),
    defaultCostCenterId: z.string().uuid().optional(),
  }),
});

export type PaymentsQuery = z.infer<typeof paymentsQuerySchema>;
export type PaymentsResponse = z.infer<typeof paymentsResponseSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
