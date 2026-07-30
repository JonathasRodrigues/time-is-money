import { z } from 'zod';
import { isoDateSchema } from '@tim/validators';
import { idNameSchema } from './common';

export const financingsQuerySchema = z.object({
  center: z.union([z.string().uuid(), z.literal('')]).optional(),
});

export const amortizationSystemSchema = z.enum(['price', 'sac', 'fixed']);
export const financingCategorySchema = z.enum(['real_estate', 'vehicle', 'personal', 'other']);
export const installmentStatusSchema = z.enum(['pending', 'paid', 'skipped']);

export const financingInstallmentSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int(),
  dueOn: isoDateSchema,
  status: installmentStatusSchema,
  amountCents: z.number().int(),
  interestCents: z.number().int(),
  principalCents: z.number().int(),
  paidOn: isoDateSchema.nullable(),
});

export const financingContractSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  institution: z.string().nullable(),
  category: financingCategorySchema,
  system: amortizationSystemSchema,
  rateLabel: z.string(),
  installmentCount: z.number().int(),
  principalCents: z.number().int(),
  installmentAmountCents: z.number().int(),
  annualRateBps: z.number().int().nullable(),
  firstDueOn: isoDateSchema,
  pendingCount: z.number().int(),
  remainingCents: z.number().int(),
  amortizeCents: z.number().int(),
  paidCents: z.number().int(),
  progress: z.number(),
  residualBalanceCents: z.number().int(),
  amortizationPerPeriodCents: z.number().int(),
  nextPending: financingInstallmentSchema.nullable(),
  installments: z.array(financingInstallmentSchema),
});

export const financingsResponseSchema = z.object({
  filters: z.object({
    centerId: z.string().uuid().nullable(),
    activeCenterName: z.string().nullable(),
  }),
  summary: z.object({
    contractCount: z.number().int(),
    totalRemainingCents: z.number().int(),
    totalAmortizeCents: z.number().int(),
    totalPaidCents: z.number().int(),
    totalPendingInstallments: z.number().int(),
  }),
  contracts: z.array(financingContractSchema),
  lookups: z.object({
    centers: z.array(idNameSchema),
    categories: z.array(idNameSchema),
    potAccounts: z.array(idNameSchema),
    planCenters: z.array(idNameSchema),
    accounts: z.array(idNameSchema),
    defaultCostCenterId: z.string().uuid().optional(),
  }),
  isEmpty: z.boolean(),
});

export type FinancingsQuery = z.infer<typeof financingsQuerySchema>;
export type FinancingsResponse = z.infer<typeof financingsResponseSchema>;
