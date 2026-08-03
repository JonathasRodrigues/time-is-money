import { z } from 'zod';
import { idNameSchema } from './common';

export const accountKindSchema = z.enum(['cash', 'checking', 'savings', 'investment_pot']);
export const yieldTypeSchema = z.enum(['none', 'cdi', 'fixed_annual']);
export const cardModeSchema = z.enum(['credit', 'debit', 'both']);

export const institutionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export const instantAccountPaymentRailSchema = z.enum(['pix', 'debit', 'ted', 'boleto']);

export const accountsAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: accountKindSchema,
  costCenterId: z.string().uuid(),
  costCenterName: z.string(),
  institutionId: z.string().uuid().nullable(),
  parentAccountId: z.string().uuid().nullable(),
  balanceCents: z.number().int(),
  yieldType: yieldTypeSchema,
  yieldBps: z.number().int().nullable(),
  yieldLabel: z.string(),
  allowedPaymentRails: z.array(instantAccountPaymentRailSchema),
  isChild: z.boolean(),
});

export const accountsCreditCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  institutionId: z.string().uuid(),
  paymentAccountId: z.string().uuid(),
  lastFour: z.string().nullable(),
  cardMode: cardModeSchema,
  creditLimitCents: z.number().int(),
  invoiceBalanceCents: z.number().int(),
  availableCents: z.number().int(),
  closingDay: z.number().int(),
  dueDay: z.number().int(),
});

export const accountsBankSectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  institutionId: z.string().uuid().nullable(),
  editable: z.boolean(),
  accounts: z.array(accountsAccountSchema),
  creditCards: z.array(accountsCreditCardSchema),
});

export const accountsResponseSchema = z.object({
  institutions: z.array(institutionSchema),
  bankSections: z.array(accountsBankSectionSchema),
  lookups: z.object({
    centers: z.array(idNameSchema),
    banks: z.array(idNameSchema),
    parentOptions: z.array(idNameSchema),
    paymentAccountOptions: z.array(idNameSchema),
    defaultPaymentAccountId: z.string().uuid().optional(),
  }),
  isEmpty: z.boolean(),
});

export type AccountsResponse = z.infer<typeof accountsResponseSchema>;
