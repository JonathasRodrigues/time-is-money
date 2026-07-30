/**
 * Minimal OpenAPI 3.1 document describing the v1 surface.
 * Keep in sync with Zod schemas and Route Handlers under apps/api/src/routes/.
 */
import { API_BASE_PATH, API_CONTRACT_VERSION, API_MAJOR } from './version';
import { apiPaths } from './paths';

const authedGet = (operationId: string, summary: string, responseSchema: string) => ({
  get: {
    operationId,
    summary,
    security: [{ clerkSession: [] }, { bearerAuth: [] }],
    responses: {
      '200': { description: responseSchema },
      '401': { description: 'Unauthorized' },
    },
  },
});

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Time is Money API',
    version: API_CONTRACT_VERSION,
    description:
      'REST contract shared by web and React Native. Read endpoints are stable; mutations will be added incrementally. See docs/api/versioning.md.',
  },
  servers: [{ url: '/', description: 'Same origin (web) or EXPO_PUBLIC_API_URL (mobile)' }],
  'x-tim-api-major': API_MAJOR,
  'x-tim-api-base': API_BASE_PATH,
  paths: {
    [apiPaths.me]: authedGet('getMe', 'Current session user and capabilities', 'MeResponse'),
    [apiPaths.bootstrap]: authedGet(
      'getBootstrap',
      'Prefs and lookup lists for app shell',
      'BootstrapResponse',
    ),
    [apiPaths.incomePrompt]: authedGet(
      'getIncomePrompt',
      'Whether to show income receipt banner (no side effects)',
      'IncomePromptResponse',
    ),
    [apiPaths.dashboard]: authedGet(
      'getDashboard',
      'Dashboard KPIs and charts',
      'DashboardResponse',
    ),
    [apiPaths.payments]: authedGet('listPayments', 'Payables and receivables', 'PaymentsResponse'),
    [apiPaths.transactions]: authedGet(
      'listTransactions',
      'Transaction ledger (extrato)',
      'TransactionsResponse',
    ),
    [apiPaths.wealth]: authedGet('getWealth', 'Net worth and allocation', 'WealthResponse'),
    [apiPaths.financings]: authedGet('listFinancings', 'Financing contracts', 'FinancingsResponse'),
    [apiPaths.planning]: authedGet('listPlans', 'Financial plans', 'PlanningResponse'),
    [apiPaths.accounts]: authedGet(
      'getAccounts',
      'Banks, accounts and credit cards',
      'AccountsResponse',
    ),
    [apiPaths.categories]: authedGet(
      'listCategories',
      'Income/expense categories',
      'CategoriesResponse',
    ),
    [apiPaths.costCenters]: authedGet('listCostCenters', 'Cost centers', 'CostCentersResponse'),
    [apiPaths.preferences]: authedGet('getPreferences', 'User preferences', 'PreferencesResponse'),
    [apiPaths.members]: authedGet(
      'listMembers',
      'Household members and invites',
      'MembersResponse',
    ),
    [apiPaths.imexTemplate]: authedGet(
      'getImportTemplate',
      'CSV template for transaction import',
      'ImportTemplateResponse',
    ),
    [apiPaths.paymentsEnsureInstances]: {
      post: {
        operationId: 'ensurePaymentInstances',
        summary: 'Materialize fixed series instances for a month',
        security: [{ clerkSession: [] }, { bearerAuth: [] }],
        responses: {
          '200': { description: 'EnsureInstancesResponse' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    [apiPaths.openapi]: {
      get: {
        operationId: 'getOpenApi',
        summary: 'OpenAPI document for this major',
        responses: { '200': { description: 'OpenAPI 3.1 JSON' } },
      },
    },
  },
  components: {
    securitySchemes: {
      clerkSession: {
        type: 'apiKey',
        in: 'cookie',
        name: '__session',
        description: 'Clerk session cookie (web)',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Clerk session JWT (React Native)',
      },
    },
  },
} as const;
