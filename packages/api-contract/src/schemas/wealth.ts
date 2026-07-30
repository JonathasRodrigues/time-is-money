import { z } from 'zod';
import { isoDateSchema } from '@tim/validators';

export const accountKindSchema = z.enum(['cash', 'checking', 'savings', 'investment_pot']);
export const yieldTypeSchema = z.enum(['none', 'cdi', 'fixed']);

export const wealthAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: accountKindSchema,
  balanceCents: z.number().int(),
  costCenterId: z.string().uuid(),
  costCenterName: z.string(),
  institutionId: z.string().uuid().nullable(),
  parentAccountId: z.string().uuid().nullable(),
  parentName: z.string().nullable(),
  yieldType: yieldTypeSchema,
  yieldBps: z.number().int().nullable(),
  monthlyYieldCents: z.number().int(),
  yieldLabel: z.string(),
});

export const wealthCardModeSchema = z.enum(['credit', 'debit', 'both']);

export const wealthCreditCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  institutionId: z.string().uuid(),
  lastFour: z.string().nullable(),
  cardMode: wealthCardModeSchema,
  invoiceBalanceCents: z.number().int(),
  availableCents: z.number().int(),
  closingDay: z.number().int(),
  dueDay: z.number().int(),
  paymentAccountId: z.string().uuid(),
});

export const wealthTransferSchema = z.object({
  id: z.string().uuid(),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  fromName: z.string(),
  toName: z.string(),
  amountCents: z.number().int(),
  occurredOn: isoDateSchema,
  description: z.string().nullable(),
});

export const wealthBankGroupSchema = z.object({
  bankId: z.string(),
  bankName: z.string(),
  bankTotalCents: z.number().int(),
  accounts: z.array(wealthAccountSchema),
  creditCards: z.array(wealthCreditCardSchema),
});

export const wealthResponseSchema = z.object({
  summary: z.object({
    assetsCents: z.number().int(),
    liabilitiesCents: z.number().int(),
    netCents: z.number().int(),
    liquidCents: z.number().int(),
    investedCents: z.number().int(),
    monthlyYieldCents: z.number().int(),
  }),
  bankGroups: z.array(wealthBankGroupSchema),
  transfers: z.array(wealthTransferSchema),
  transferForm: z.object({
    accounts: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        kind: accountKindSchema,
        balanceCents: z.number().int(),
        label: z.string(),
      }),
    ),
    defaultFromId: z.string().uuid(),
    defaultToId: z.string().uuid(),
    today: isoDateSchema,
  }),
  paymentAccountOptions: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  isEmpty: z.boolean(),
});

export type WealthResponse = z.infer<typeof wealthResponseSchema>;
