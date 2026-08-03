import { z } from 'zod';
import { isoDateSchema } from '@tim/validators';
import { dateRangeQuerySchema } from './common';

export const transactionPaymentRailFilterSchema = z.enum([
  'pix',
  'debit',
  'ted',
  'boleto',
  'cash',
  'other',
  'credit_card',
]);

export const transactionsQuerySchema = dateRangeQuerySchema.extend({
  type: z.enum(['income', 'expense']).optional(),
  status: z.enum(['pending', 'paid']).optional(),
  category: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  bank: z.string().uuid().optional(),
  account: z.string().uuid().optional(),
  rail: transactionPaymentRailFilterSchema.optional(),
  card: z.string().uuid().optional(),
});

export const transactionRowSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['income', 'expense']),
  status: z.enum(['pending', 'paid']),
  amountCents: z.number().int().nullable(),
  occurredOn: isoDateSchema,
  dueOn: isoDateSchema.nullable(),
  paidOn: isoDateSchema.nullable(),
  displayDate: isoDateSchema,
  displayDateKind: z.enum(['payment', 'receipt', 'due']),
  description: z.string().nullable(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  costCenterId: z.string().uuid(),
  costCenterName: z.string(),
  accountId: z.string().uuid(),
  installmentId: z.string().uuid().nullable(),
});

export const transactionsResponseSchema = z.object({
  canEdit: z.boolean(),
  range: z.object({
    start: isoDateSchema,
    end: isoDateSchema,
    period: z.string(),
    label: z.string(),
  }),
  scopeLabel: z.string(),
  totals: z.object({
    totalCount: z.number().int(),
    incomeCents: z.number().int(),
    expenseCents: z.number().int(),
    truncated: z.boolean(),
  }),
  rows: z.array(transactionRowSchema),
  filters: z.object({
    centerId: z.string().uuid().nullable(),
    typeFilter: z.enum(['income', 'expense']).nullable(),
    statusFilter: z.enum(['pending', 'paid']).nullable(),
    categoryFilter: z.string().uuid().nullable(),
    searchQuery: z.string(),
    bankFilter: z.string().uuid().nullable(),
    accountFilter: z.string().uuid().nullable(),
    railFilter: transactionPaymentRailFilterSchema.nullable(),
    cardFilter: z.string().uuid().nullable(),
  }),
  lookups: z.object({
    centers: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    categories: z.array(
      z.object({ id: z.string().uuid(), name: z.string(), type: z.enum(['income', 'expense']) }),
    ),
    banks: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    accounts: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        institutionId: z.string().uuid().nullable(),
        allowedPaymentRails: z.array(z.enum(['pix', 'debit', 'ted', 'boleto'])),
      }),
    ),
    creditCards: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        paymentAccountId: z.string().uuid(),
        institutionId: z.string().uuid(),
        lastFour: z.string().nullable().optional(),
      }),
    ),
    defaultCostCenterId: z.string().uuid().optional(),
    defaultOccurredOn: isoDateSchema,
  }),
});

export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
export type TransactionsResponse = z.infer<typeof transactionsResponseSchema>;
export type TransactionPaymentRailFilter = z.infer<typeof transactionPaymentRailFilterSchema>;
