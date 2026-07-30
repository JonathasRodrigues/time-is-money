import { describe, expect, it } from 'vitest';
import {
  apiErrorBodySchema,
  bootstrapResponseSchema,
  ensureInstancesResponseSchema,
  incomePromptResponseSchema,
  meResponseSchema,
  API_BASE_PATH,
  API_CONTRACT_VERSION,
  apiPaths,
} from './index';
import { openApiDocument } from './openapi';

describe('@tim/api-contract', () => {
  it('pins v1 base path and semver', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
    expect(API_CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(apiPaths.me).toBe('/api/v1/me');
  });

  it('accepts me response fixture', () => {
    const parsed = meResponseSchema.parse({
      userId: 'user_1',
      email: 'a@b.com',
      householdId: '00000000-0000-4000-8000-000000000001',
      role: 'admin',
      mfaEnabled: true,
      canManageMembers: true,
      capabilities: ['dashboard.read'],
    });
    expect(parsed.role).toBe('admin');
  });

  it('accepts bootstrap fixture', () => {
    const parsed = bootstrapResponseSchema.parse({
      ttsEnabled: false,
      theme: 'system',
      incomeDay: 5,
      costCenters: [],
      accounts: [],
      categories: [],
    });
    expect(parsed.theme).toBe('system');
  });

  it('accepts income-prompt fixture', () => {
    const parsed = incomePromptResponseSchema.parse({
      show: false,
      mode: 'none',
      incomeDay: null,
      pendingIncomes: [],
      accounts: [],
      yearMonth: '2026-07',
    });
    expect(parsed.show).toBe(false);
  });

  it('accepts ensure-instances response', () => {
    expect(ensureInstancesResponseSchema.parse({ ok: true, yearMonth: '2026-07' })).toEqual({
      ok: true,
      yearMonth: '2026-07',
    });
  });

  it('accepts error envelope', () => {
    const parsed = apiErrorBodySchema.parse({
      error: { code: 'UNAUTHORIZED', message: 'Não autenticado' },
    });
    expect(parsed.error.code).toBe('UNAUTHORIZED');
  });

  it('documents read paths in OpenAPI', () => {
    const documented = new Set(Object.keys(openApiDocument.paths));
    const mutationOnly = new Set<string>([
      apiPaths.households,
      apiPaths.transactionsPayBulk,
      apiPaths.transactionsPending,
      apiPaths.transactionsMonthlySeries,
      apiPaths.transfers,
      apiPaths.institutions,
      apiPaths.creditCards,
      apiPaths.financingsPayInstallmentsBulk,
      apiPaths.plans,
      apiPaths.incomePromptConfirm,
      apiPaths.incomePromptConfirmItem,
      apiPaths.incomePromptSnooze,
      apiPaths.preferencesTheme,
      apiPaths.membersInvites,
      apiPaths.invitesAccept,
      apiPaths.invitesAcceptById,
      apiPaths.imexExport,
      apiPaths.imexImportPreview,
      apiPaths.jarvisMessages,
    ]);
    for (const path of Object.values(apiPaths)) {
      if (mutationOnly.has(path)) continue;
      expect(documented.has(path)).toBe(true);
    }
  });
});
