import {
  confirmIncomeItemBodySchema,
  createAccountBodySchema,
  createCategoryBodySchema,
  createCostCenterBodySchema,
  createCreditCardBodySchema,
  createFinancingBodySchema,
  createHouseholdBodySchema,
  createInstitutionBodySchema,
  setupBankBodySchema,
  createMonthlySeriesBodySchema,
  createPendingTransactionBodySchema,
  createPlanBodySchema,
  createTransactionBodySchema,
  createTransferBodySchema,
  okResponseSchema,
  okWithHouseholdIdResponseSchema,
  okWithIdResponseSchema,
  okWithPlanIdResponseSchema,
  okWithRedirectResponseSchema,
  payCreditCardInvoiceBodySchema,
  payInstallmentBodySchema,
  payInstallmentsBulkBodySchema,
  payTransactionBodySchema,
  payTransactionsBulkBodySchema,
  rebuildFinancingBodySchema,
  updateAccountBalanceBodySchema,
  updateAccountBodySchema,
  updateCreditCardBodySchema,
  updateInstitutionBodySchema,
  updatePendingAmountBodySchema,
  updatePlanBodySchema,
  updatePreferencesBodySchema,
  updateThemeBodySchema,
  updateTransactionBodySchema,
  upsertPlanContributionsBodySchema,
  upsertPlanItemsBodySchema,
} from '@tim/api-contract';
import {
  confirmIncomeItem,
  confirmIncomeReceipt,
  createAccount,
  createCategory,
  createCostCenter,
  createCreditCard,
  createFinancing,
  createHousehold,
  createInstitution,
  setupBank,
  createMonthlySeries,
  createPendingTransaction,
  createPlan,
  createTransaction,
  createTransfer,
  payCreditCardInvoice,
  payInstallmentWithCategory,
  payInstallmentsBulk,
  payTransaction,
  payTransactionsBulk,
  rebuildFinancing,
  snoozeIncomeReceipt,
  softDeleteFinancing,
  softDeletePlan,
  softDeleteTransaction,
  updateAccount,
  updateAccountBalance,
  updateCreditCard,
  updateInstitution,
  updatePendingAmount,
  updatePlan,
  updatePreferences,
  updateThemePreference,
  updateTransaction,
  upsertPlanContributions,
  upsertPlanItems,
} from '@tim/application';
import { requireSession } from '@tim/auth';
import {
  softDeleteFinancingSchema,
  softDeletePlanSchema,
  softDeleteTransactionSchema,
} from '@tim/validators';
import {
  createCreditCardSchema,
  createFinancingSchema,
  createMonthlySeriesSchema,
  createPendingTransactionSchema,
  createPlanSchema,
  createTransactionSchema,
  createTransferSchema,
  payCreditCardInvoiceSchema,
  payInstallmentSchema,
  payInstallmentsBulkSchema,
  payTransactionSchema,
  payTransactionsBulkSchema,
  rebuildFinancingSchema,
  updateCreditCardSchema,
  updatePendingAmountSchema,
  updatePlanSchema,
  updateTransactionSchema,
  upsertPlanContributionsSchema,
  upsertPlanItemsSchema,
} from '@tim/validators';
import type {
  CreateCreditCardInput,
  CreateFinancingInput,
  CreateMonthlySeriesInput,
  CreatePendingTransactionInput,
} from '@tim/validators';
import { Hono } from 'hono';
import { createAppContext } from '../context.js';
import {
  handleApiRoute,
  jsonOk,
  parseWithSchema,
  requireApiContext,
  ApiHttpError,
} from '../http.js';
import { parseBody, parseJsonBody, householdInput } from '../lib/mutation.js';

export const mutationRoutes = new Hono();

function ok() {
  return jsonOk(parseWithSchema(okResponseSchema, { ok: true as const }));
}

// --- Household (onboarding) ---

mutationRoutes.post('/households', (c) =>
  handleApiRoute(async () => {
    const ctx = await createAppContext(c.req.raw);
    const session = ctx.session;
    if (!session?.userId) {
      throw new ApiHttpError('UNAUTHORIZED', 'Não autenticado');
    }
    const body = parseBody(createHouseholdBodySchema, await parseJsonBody(c.req.raw));
    const result = await createHousehold(ctx, {
      userId: session.userId,
      email: session.email,
      name: body.name,
    });
    return jsonOk(
      parseWithSchema(okWithHouseholdIdResponseSchema, {
        ok: true as const,
        householdId: result.householdId,
      }),
    );
  }),
);

// --- Transactions ---

mutationRoutes.post('/transactions', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await createTransaction(
      ctx,
      householdInput(session, createTransactionSchema, partial),
      'manual',
    );
    return ok();
  }),
);

mutationRoutes.post('/transactions/pending', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await createPendingTransaction(
      ctx,
      householdInput(
        session,
        createPendingTransactionSchema,
        partial,
      ) as CreatePendingTransactionInput,
      'manual',
    );
    return ok();
  }),
);

mutationRoutes.post('/transactions/monthly-series', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await createMonthlySeries(
      ctx,
      householdInput(session, createMonthlySeriesSchema, partial) as CreateMonthlySeriesInput,
    );
    return ok();
  }),
);

mutationRoutes.patch('/transactions/:transactionId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await updateTransaction(
      ctx,
      householdInput(session, updateTransactionSchema, {
        ...(partial as object),
        transactionId: c.req.param('transactionId'),
      }),
    );
    return ok();
  }),
);

mutationRoutes.delete('/transactions/:transactionId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const input = softDeleteTransactionSchema.parse({
      householdId: session.householdId,
      transactionId: c.req.param('transactionId'),
    });
    await softDeleteTransaction(ctx, input);
    return ok();
  }),
);

mutationRoutes.post('/transactions/:transactionId/pay', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await payTransaction(
      ctx,
      householdInput(session, payTransactionSchema, {
        ...(partial as object),
        transactionId: c.req.param('transactionId'),
      }),
    );
    return ok();
  }),
);

mutationRoutes.post('/transactions/pay-bulk', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await payTransactionsBulk(ctx, householdInput(session, payTransactionsBulkSchema, partial));
    return ok();
  }),
);

mutationRoutes.patch('/transactions/:transactionId/pending-amount', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await updatePendingAmount(
      ctx,
      householdInput(session, updatePendingAmountSchema, {
        ...(partial as object),
        transactionId: c.req.param('transactionId'),
      }),
    );
    return ok();
  }),
);

// --- Settings ---

mutationRoutes.post('/cost-centers', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(createCostCenterBodySchema, await parseJsonBody(c.req.raw));
    await createCostCenter(ctx, body);
    return ok();
  }),
);

mutationRoutes.post('/categories', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(createCategoryBodySchema, await parseJsonBody(c.req.raw));
    await createCategory(ctx, body);
    return ok();
  }),
);

mutationRoutes.post('/institutions', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(createInstitutionBodySchema, await parseJsonBody(c.req.raw));
    await createInstitution(ctx, body);
    return ok();
  }),
);

mutationRoutes.post('/institutions/setup', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(setupBankBodySchema, await parseJsonBody(c.req.raw));
    await setupBank(ctx, body);
    return ok();
  }),
);

mutationRoutes.patch('/institutions/:institutionId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(updateInstitutionBodySchema, await parseJsonBody(c.req.raw));
    await updateInstitution(ctx, c.req.param('institutionId'), body);
    return ok();
  }),
);

mutationRoutes.post('/accounts', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(createAccountBodySchema, await parseJsonBody(c.req.raw));
    const result = await createAccount(ctx, body);
    return jsonOk(parseWithSchema(okWithIdResponseSchema, { ok: true as const, id: result.id }));
  }),
);

mutationRoutes.patch('/accounts/:accountId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(updateAccountBodySchema, await parseJsonBody(c.req.raw));
    await updateAccount(ctx, c.req.param('accountId'), body);
    return ok();
  }),
);

mutationRoutes.patch('/accounts/:accountId/balance', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(updateAccountBalanceBodySchema, await parseJsonBody(c.req.raw));
    await updateAccountBalance(ctx, c.req.param('accountId'), body);
    return ok();
  }),
);

mutationRoutes.post('/credit-cards', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await createCreditCard(
      ctx,
      householdInput(session, createCreditCardSchema, partial) as CreateCreditCardInput,
    );
    return ok();
  }),
);

mutationRoutes.patch('/credit-cards/:creditCardId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await updateCreditCard(
      ctx,
      householdInput(session, updateCreditCardSchema, {
        ...(partial as object),
        creditCardId: c.req.param('creditCardId'),
      }),
    );
    return ok();
  }),
);

mutationRoutes.post('/credit-cards/:creditCardId/pay-invoice', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await payCreditCardInvoice(
      ctx,
      householdInput(session, payCreditCardInvoiceSchema, {
        ...(partial as object),
        creditCardId: c.req.param('creditCardId'),
      }),
    );
    return ok();
  }),
);

mutationRoutes.post('/transfers', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await createTransfer(ctx, householdInput(session, createTransferSchema, partial));
    return ok();
  }),
);

// --- Financings ---

mutationRoutes.post('/financings', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await createFinancing(
      ctx,
      householdInput(session, createFinancingSchema, partial) as CreateFinancingInput,
    );
    return ok();
  }),
);

mutationRoutes.post('/financings/installments/:installmentId/pay', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await payInstallmentWithCategory(
      ctx,
      householdInput(session, payInstallmentSchema, {
        ...(partial as object),
        installmentId: c.req.param('installmentId'),
      }),
    );
    return ok();
  }),
);

mutationRoutes.post('/financings/pay-installments-bulk', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await payInstallmentsBulk(ctx, householdInput(session, payInstallmentsBulkSchema, partial));
    return ok();
  }),
);

mutationRoutes.post('/financings/:financingId/rebuild', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await rebuildFinancing(
      ctx,
      householdInput(session, rebuildFinancingSchema, {
        ...(partial as object),
        financingId: c.req.param('financingId'),
      }),
    );
    return ok();
  }),
);

mutationRoutes.delete('/financings/:financingId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const input = softDeleteFinancingSchema.parse({
      householdId: session.householdId,
      financingId: c.req.param('financingId'),
    });
    await softDeleteFinancing(ctx, input);
    return ok();
  }),
);

// --- Planning ---

mutationRoutes.post('/plans', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    const plan = await createPlan(ctx, householdInput(session, createPlanSchema, partial));
    return jsonOk(
      parseWithSchema(okWithPlanIdResponseSchema, { ok: true as const, planId: plan.id }),
    );
  }),
);

mutationRoutes.patch('/plans/:planId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await updatePlan(
      ctx,
      householdInput(session, updatePlanSchema, {
        ...(partial as object),
        planId: c.req.param('planId'),
      }),
    );
    return ok();
  }),
);

mutationRoutes.put('/plans/:planId/items', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await upsertPlanItems(
      ctx,
      householdInput(session, upsertPlanItemsSchema, {
        ...(partial as object),
        planId: c.req.param('planId'),
      }),
    );
    return ok();
  }),
);

mutationRoutes.put('/plans/:planId/contributions', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const partial = await parseJsonBody(c.req.raw);
    await upsertPlanContributions(
      ctx,
      householdInput(session, upsertPlanContributionsSchema, {
        ...(partial as object),
        planId: c.req.param('planId'),
      }),
    );
    return ok();
  }),
);

mutationRoutes.delete('/plans/:planId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    const input = softDeletePlanSchema.parse({
      planId: c.req.param('planId'),
      householdId: session.householdId,
    });
    await softDeletePlan(ctx, input);
    return ok();
  }),
);

// --- Preferences & income prompt ---

mutationRoutes.patch('/preferences', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(updatePreferencesBodySchema, await parseJsonBody(c.req.raw));
    await updatePreferences(ctx, body);
    return ok();
  }),
);

mutationRoutes.patch('/preferences/theme', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(updateThemeBodySchema, await parseJsonBody(c.req.raw));
    await updateThemePreference(ctx, body.theme);
    return ok();
  }),
);

mutationRoutes.post('/income-prompt/confirm', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const result = await confirmIncomeReceipt(ctx);
    return jsonOk(parseWithSchema(okWithRedirectResponseSchema, { ok: true as const, ...result }));
  }),
);

mutationRoutes.post('/income-prompt/confirm-item', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(confirmIncomeItemBodySchema, await parseJsonBody(c.req.raw));
    const result = await confirmIncomeItem(ctx, body);
    return jsonOk(parseWithSchema(okWithRedirectResponseSchema, { ok: true as const, ...result }));
  }),
);

mutationRoutes.post('/income-prompt/snooze', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    await snoozeIncomeReceipt(ctx);
    return ok();
  }),
);
