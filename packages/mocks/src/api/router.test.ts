import { API_BASE_PATH } from '@tim/api-contract';
import { describe, expect, it, beforeEach } from 'vitest';
import { handleMockApiRequest } from './router';
import { resetMockStore } from './store';

describe('@tim/mocks/api', () => {
  beforeEach(() => {
    resetMockStore();
  });

  it('returns me and bootstrap', async () => {
    const me = await handleMockApiRequest<{ householdId: string }>(`${API_BASE_PATH}/me`);
    expect(me.householdId).toBeTruthy();

    const bootstrap = await handleMockApiRequest<{ costCenters: unknown[] }>(
      `${API_BASE_PATH}/bootstrap`,
    );
    expect(bootstrap.costCenters.length).toBeGreaterThan(0);
  });

  it('lists transactions and accepts create', async () => {
    const before = await handleMockApiRequest<{ totals: { totalCount: number } }>(
      `${API_BASE_PATH}/transactions`,
    );
    const countBefore = before.totals.totalCount;

    await handleMockApiRequest(`${API_BASE_PATH}/transactions`, {
      method: 'POST',
      body: {
        type: 'expense',
        status: 'paid',
        amountCents: 9_99,
        occurredOn: new Date().toISOString().slice(0, 10),
        description: 'Teste mock',
        categoryId: '00000000-0000-4000-8000-000000000702',
        costCenterId: '00000000-0000-4000-8000-000000000301',
        accountId: '00000000-0000-4000-8000-000000000502',
      },
    });

    const after = await handleMockApiRequest<{ totals: { totalCount: number } }>(
      `${API_BASE_PATH}/transactions`,
    );
    expect(after.totals.totalCount).toBe(countBefore + 1);
  });

  it('returns dashboard from store', async () => {
    const dashboard = await handleMockApiRequest<{ kpis: { income: { cents: number } } }>(
      `${API_BASE_PATH}/dashboard`,
    );
    expect(dashboard.kpis.income.cents).toBeGreaterThan(0);
  });

  it('respeita period=next_month em payments', async () => {
    const payments = await handleMockApiRequest<{
      range: { period: string; label: string; start: string; end: string };
      rows: Array<{ description: string | null }>;
    }>(`${API_BASE_PATH}/payments?period=next_month`);

    expect(payments.range.period).toBe('next_month');
    expect(payments.range.start.endsWith('-01')).toBe(true);
    expect(payments.rows.some((row) => row.description?.includes('próximo mês'))).toBe(true);
  });
});
