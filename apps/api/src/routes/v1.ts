import {
  accountsResponseSchema,
  bootstrapResponseSchema,
  categoriesResponseSchema,
  costCentersResponseSchema,
  dashboardQuerySchema,
  dashboardResponseSchema,
  ensureInstancesBodySchema,
  ensureInstancesResponseSchema,
  financingsQuerySchema,
  financingsResponseSchema,
  incomePromptResponseSchema,
  meResponseSchema,
  membersResponseSchema,
  openApiDocument,
  paymentsQuerySchema,
  paymentsResponseSchema,
  planningQuerySchema,
  planningResponseSchema,
  preferencesResponseSchema,
  transactionsQuerySchema,
  transactionsResponseSchema,
  wealthResponseSchema,
  API_VERSION_HEADER,
} from '@tim/api-contract';
import {
  buildMeResponse,
  ensureSeriesInstancesForMonth,
  loadAccounts,
  loadBootstrap,
  loadCategories,
  loadCostCenters,
  loadDashboard,
  loadFinancings,
  loadIncomePrompt,
  loadMembers,
  loadPayments,
  loadPlanning,
  loadPreferences,
  loadTransactions,
  loadWealth,
  yearMonthFromIso,
} from '@tim/application';
import { AuthError, requireCapability } from '@tim/auth';
import { Hono } from 'hono';
import {
  ApiHttpError,
  handleApiRoute,
  jsonOk,
  parseWithSchema,
  requireApiContext,
  requireApiSession,
} from '../http.js';
import { parseQueryParams, searchParamsToRecord } from '../parse-request.js';
import { mutationRoutes } from './mutations.js';
import { integrationRoutes } from './integrations.js';

export const v1Routes = new Hono();

v1Routes.route('/', mutationRoutes);
v1Routes.route('/', integrationRoutes);

v1Routes.get('/me', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    return jsonOk(parseWithSchema(meResponseSchema, buildMeResponse(ctx)));
  }),
);

v1Routes.get('/bootstrap', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    return jsonOk(parseWithSchema(bootstrapResponseSchema, await loadBootstrap(ctx)));
  }),
);

v1Routes.get('/income-prompt', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    return jsonOk(parseWithSchema(incomePromptResponseSchema, await loadIncomePrompt(ctx)));
  }),
);

v1Routes.get('/dashboard', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const query = parseQueryParams(dashboardQuerySchema, searchParamsToRecord(new URL(c.req.url)));
    return jsonOk(parseWithSchema(dashboardResponseSchema, await loadDashboard(ctx, query)));
  }),
);

v1Routes.get('/payments', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const query = parseQueryParams(paymentsQuerySchema, searchParamsToRecord(new URL(c.req.url)));
    return jsonOk(parseWithSchema(paymentsResponseSchema, await loadPayments(ctx, query)));
  }),
);

v1Routes.post('/payments/ensure-instances', (c) =>
  handleApiRoute(async () => {
    const session = await requireApiSession(c.req.raw);
    try {
      requireCapability(session, 'transactions.write');
    } catch (err) {
      if (err instanceof AuthError) {
        throw new ApiHttpError('FORBIDDEN', err.message);
      }
      throw new ApiHttpError('FORBIDDEN', 'Sem permissão: transactions.write');
    }

    let raw: unknown = {};
    const text = await c.req.text();
    if (text.trim().length > 0) {
      raw = JSON.parse(text) as unknown;
    }
    const input = parseWithSchema(ensureInstancesBodySchema, raw);
    const yearMonth = input.yearMonth ?? yearMonthFromIso(new Date().toISOString().slice(0, 10));

    const ctx = await requireApiContext(c.req.raw);
    await ensureSeriesInstancesForMonth(ctx, yearMonth);

    return jsonOk(parseWithSchema(ensureInstancesResponseSchema, { ok: true as const, yearMonth }));
  }),
);

v1Routes.get('/transactions', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const query = parseQueryParams(
      transactionsQuerySchema,
      searchParamsToRecord(new URL(c.req.url)),
    );
    return jsonOk(parseWithSchema(transactionsResponseSchema, await loadTransactions(ctx, query)));
  }),
);

v1Routes.get('/wealth', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    return jsonOk(parseWithSchema(wealthResponseSchema, await loadWealth(ctx)));
  }),
);

v1Routes.get('/financings', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const query = parseQueryParams(financingsQuerySchema, searchParamsToRecord(new URL(c.req.url)));
    return jsonOk(parseWithSchema(financingsResponseSchema, await loadFinancings(ctx, query)));
  }),
);

v1Routes.get('/planning', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const query = parseQueryParams(planningQuerySchema, searchParamsToRecord(new URL(c.req.url)));
    return jsonOk(parseWithSchema(planningResponseSchema, await loadPlanning(ctx, query)));
  }),
);

v1Routes.get('/accounts', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    return jsonOk(parseWithSchema(accountsResponseSchema, await loadAccounts(ctx)));
  }),
);

v1Routes.get('/categories', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    return jsonOk(parseWithSchema(categoriesResponseSchema, await loadCategories(ctx)));
  }),
);

v1Routes.get('/cost-centers', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    return jsonOk(parseWithSchema(costCentersResponseSchema, await loadCostCenters(ctx)));
  }),
);

v1Routes.get('/preferences', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    return jsonOk(parseWithSchema(preferencesResponseSchema, await loadPreferences(ctx)));
  }),
);

v1Routes.get('/members', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    return jsonOk(parseWithSchema(membersResponseSchema, await loadMembers(ctx)));
  }),
);

v1Routes.get('/openapi.json', (c) =>
  c.json(openApiDocument, 200, {
    [API_VERSION_HEADER]: '1',
    'Cache-Control': 'public, max-age=300',
  }),
);
