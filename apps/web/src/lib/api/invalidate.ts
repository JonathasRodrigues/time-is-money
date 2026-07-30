import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/query-keys';

export type InvalidateScope = 'money' | 'settings' | 'financing' | 'members' | 'session';

export async function invalidateMoneyQueries(client: QueryClient): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: [...queryKeys.root, 'dashboard'] }),
    client.invalidateQueries({ queryKey: [...queryKeys.root, 'payments'] }),
    client.invalidateQueries({ queryKey: [...queryKeys.root, 'transactions'] }),
    client.invalidateQueries({ queryKey: queryKeys.wealth() }),
    client.invalidateQueries({ queryKey: queryKeys.incomePrompt() }),
  ]);
}

export async function invalidateSettingsQueries(client: QueryClient): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.bootstrap() }),
    client.invalidateQueries({ queryKey: queryKeys.accounts() }),
    client.invalidateQueries({ queryKey: queryKeys.categories() }),
    client.invalidateQueries({ queryKey: queryKeys.costCenters() }),
    client.invalidateQueries({ queryKey: queryKeys.preferences() }),
    client.invalidateQueries({ queryKey: queryKeys.wealth() }),
  ]);
}

export async function invalidateFinancingQueries(client: QueryClient): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: [...queryKeys.root, 'financings'] }),
    client.invalidateQueries({ queryKey: [...queryKeys.root, 'planning'] }),
    invalidateMoneyQueries(client),
  ]);
}

export async function invalidateMembersQueries(client: QueryClient): Promise<void> {
  await client.invalidateQueries({ queryKey: queryKeys.members() });
}

/** Full cache reset after household switch (onboarding, accept invite). */
export async function invalidateSessionQueries(client: QueryClient): Promise<void> {
  await client.invalidateQueries({ queryKey: queryKeys.root });
}

export async function invalidateByScope(
  client: QueryClient,
  scope: InvalidateScope | readonly InvalidateScope[],
): Promise<void> {
  const scopes = Array.isArray(scope) ? scope : [scope];
  for (const item of scopes) {
    switch (item) {
      case 'money':
        await invalidateMoneyQueries(client);
        break;
      case 'settings':
        await invalidateSettingsQueries(client);
        break;
      case 'financing':
        await invalidateFinancingQueries(client);
        break;
      case 'members':
        await invalidateMembersQueries(client);
        break;
      case 'session':
        await invalidateSessionQueries(client);
        break;
    }
  }
}
