import { z } from 'zod';
import { isoDateSchema } from '@tim/validators';
import { idNameSchema } from './common';
import { amortizationSystemSchema, financingCategorySchema } from './financings';

export const planKindSchema = z.enum([
  'travel',
  'financing_payoff',
  'real_estate_amortization',
  'custom',
]);

export const planningQuerySchema = z.object({
  kind: z.union([z.literal('all'), planKindSchema]).optional(),
});

export const planItemSchema = z.object({
  label: z.string(),
  amountCents: z.number().int(),
});

export const planContributionSchema = z.object({
  dueOn: isoDateSchema,
  amountCents: z.number().int(),
});

export const planFinancingInstallmentSchema = z.object({
  number: z.number().int(),
  dueOn: isoDateSchema,
  principalCents: z.number().int(),
  amountCents: z.number().int(),
  interestCents: z.number().int(),
});

export const planFinancingPayoffSchema = z.object({
  balanceCents: z.number().int(),
  system: amortizationSystemSchema,
  annualRateBps: z.number().int().nullable(),
  installmentAmountCents: z.number().int(),
  amortizationCents: z.number().int(),
  firstDueOn: isoDateSchema,
  pendingInstallments: z.array(planFinancingInstallmentSchema),
});

export const planCardSchema = z.object({
  id: z.string().uuid(),
  kind: planKindSchema,
  name: z.string(),
  targetDate: isoDateSchema,
  savedCents: z.number().int(),
  targetCents: z.number().int(),
  monthlyTargetCents: z.number().int().nullable(),
  linkedAccountName: z.string().nullable(),
  financingName: z.string().nullable(),
  items: z.array(planItemSchema),
  contributions: z.array(planContributionSchema),
  financingPayoff: planFinancingPayoffSchema.optional(),
  canWrite: z.boolean(),
});

export const financingOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: financingCategorySchema,
  balanceCents: z.number().int(),
  system: amortizationSystemSchema,
  annualRateBps: z.number().int().nullable(),
  installmentAmountCents: z.number().int(),
  amortizationCents: z.number().int(),
  firstDueOn: isoDateSchema,
  pendingInstallments: z.array(planFinancingInstallmentSchema),
});

export const planningResponseSchema = z.object({
  filters: z.object({
    kind: z.union([z.literal('all'), planKindSchema]),
  }),
  summary: z.object({
    totalPlannedCents: z.number().int(),
    totalSavedCents: z.number().int(),
    totalRemainingCents: z.number().int(),
    nextPlan: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        targetDate: isoDateSchema,
        kind: planKindSchema,
      })
      .nullable(),
  }),
  plans: z.array(planCardSchema),
  lookups: z.object({
    centers: z.array(idNameSchema),
    potAccounts: z.array(idNameSchema),
    financings: z.array(financingOptionSchema),
  }),
  canWrite: z.boolean(),
  isEmpty: z.boolean(),
});

export type PlanningQuery = z.infer<typeof planningQuerySchema>;
export type PlanningResponse = z.infer<typeof planningResponseSchema>;
