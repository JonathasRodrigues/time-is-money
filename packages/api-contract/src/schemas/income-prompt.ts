import { z } from 'zod';
import { isoDateSchema } from '@tim/validators';
import { idNameSchema, yearMonthSchema } from './common';

export const pendingIncomeItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  dueOn: isoDateSchema,
  accountId: z.string().uuid(),
  amountCents: z.number().int().nullable(),
  suggestedCents: z.number().int().nullable(),
});

export const incomePromptModeSchema = z.enum(['series', 'generic', 'none']);

export const incomePromptResponseSchema = z.object({
  show: z.boolean(),
  mode: incomePromptModeSchema,
  incomeDay: z.number().int().min(1).max(28).nullable(),
  pendingIncomes: z.array(pendingIncomeItemSchema),
  accounts: z.array(idNameSchema),
  yearMonth: yearMonthSchema,
});

export type IncomePromptResponse = z.infer<typeof incomePromptResponseSchema>;
export type PendingIncomeItem = z.infer<typeof pendingIncomeItemSchema>;
