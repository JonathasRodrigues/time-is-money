import {
  createAccountSchema,
  createCategorySchema,
  createCostCenterSchema,
  createCreditCardSchema,
  createFinancingSchema,
  createInstitutionSchema,
  setupBankSchema,
  createMonthlySeriesSchema,
  createPendingTransactionSchema,
  createPlanSchema,
  createTransactionSchema,
  createTransferSchema,
  isoDateSchema,
  moneyCentsSchema,
  payCreditCardInvoiceSchema,
  payInstallmentSchema,
  payInstallmentsBulkSchema,
  payTransactionSchema,
  payTransactionsBulkSchema,
  rebuildFinancingSchema,
  themePreferenceSchema,
  updateAccountBalanceSchema,
  updateAccountSchema,
  updateCreditCardSchema,
  updateInstitutionSchema,
  updatePendingAmountSchema,
  updatePlanSchema,
  updatePreferencesSchema,
  updateTransactionSchema,
  upsertPlanContributionsSchema,
  upsertPlanItemsSchema,
} from '@tim/validators';
import { z } from 'zod';

const omitHousehold = (schema: z.ZodTypeAny): z.ZodObject<z.ZodRawShape> => {
  let current: z.ZodTypeAny = schema;
  while (current instanceof z.ZodEffects) {
    current = current._def.schema;
  }
  if (!(current instanceof z.ZodObject)) {
    throw new Error('omitHousehold expects a ZodObject schema');
  }
  return current.omit({ householdId: true });
};

export const createTransactionBodySchema = omitHousehold(createTransactionSchema);
export const createPendingTransactionBodySchema = omitHousehold(createPendingTransactionSchema);
export const createMonthlySeriesBodySchema = omitHousehold(createMonthlySeriesSchema);
export const updateTransactionBodySchema = omitHousehold(updateTransactionSchema);
export const updatePendingAmountBodySchema = omitHousehold(updatePendingAmountSchema);
export const payTransactionBodySchema = omitHousehold(payTransactionSchema).omit({
  transactionId: true,
});
export const payTransactionsBulkBodySchema = omitHousehold(payTransactionsBulkSchema);

export const createCostCenterBodySchema = omitHousehold(createCostCenterSchema);
export const createCategoryBodySchema = omitHousehold(createCategorySchema);
export const createInstitutionBodySchema = omitHousehold(createInstitutionSchema);
export const setupBankBodySchema = omitHousehold(setupBankSchema);
export const updateInstitutionBodySchema = omitHousehold(updateInstitutionSchema).omit({
  institutionId: true,
});
export const createAccountBodySchema = omitHousehold(createAccountSchema);
export const updateAccountBodySchema = omitHousehold(updateAccountSchema).omit({
  accountId: true,
});
export const updateAccountBalanceBodySchema = omitHousehold(updateAccountBalanceSchema).omit({
  accountId: true,
});
export const createCreditCardBodySchema = omitHousehold(createCreditCardSchema);
export const updateCreditCardBodySchema = omitHousehold(updateCreditCardSchema).omit({
  creditCardId: true,
});
export const payCreditCardInvoiceBodySchema = omitHousehold(payCreditCardInvoiceSchema).omit({
  creditCardId: true,
});
export const createTransferBodySchema = omitHousehold(createTransferSchema);

export const createFinancingBodySchema = omitHousehold(createFinancingSchema);
export const payInstallmentBodySchema = omitHousehold(payInstallmentSchema).omit({
  installmentId: true,
});
export const payInstallmentsBulkBodySchema = omitHousehold(payInstallmentsBulkSchema);
export const rebuildFinancingBodySchema = omitHousehold(rebuildFinancingSchema).omit({
  financingId: true,
});

export const createPlanBodySchema = omitHousehold(createPlanSchema);
export const updatePlanBodySchema = omitHousehold(updatePlanSchema).omit({ planId: true });
export const upsertPlanItemsBodySchema = omitHousehold(upsertPlanItemsSchema).omit({
  planId: true,
});
export const upsertPlanContributionsBodySchema = omitHousehold(upsertPlanContributionsSchema).omit({
  planId: true,
});

export const updatePreferencesBodySchema = updatePreferencesSchema;

export const updateThemeBodySchema = z.object({
  theme: themePreferenceSchema,
});

export const confirmIncomeItemBodySchema = z.object({
  transactionId: z.string().uuid(),
  paidOn: isoDateSchema,
  amountCents: moneyCentsSchema,
  accountId: z.string().uuid().optional(),
  applyToBalance: z.boolean().optional(),
});

export const createHouseholdBodySchema = z.object({
  name: z.string().min(1).max(120),
});
