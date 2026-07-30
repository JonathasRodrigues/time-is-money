import type { PreferencesResponse } from '@tim/api-contract';
import { accounts, costCenters, userPreferences } from '@tim/db';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@tim/auth';
import type { AppContext } from '../context';

export async function loadPreferences(ctx: AppContext): Promise<PreferencesResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(
      and(
        eq(userPreferences.householdId, session.householdId),
        eq(userPreferences.userId, session.userId),
      ),
    )
    .limit(1);
  const [centers, accs] = await Promise.all([
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
  ]);

  const theme =
    prefs?.theme === 'light' || prefs?.theme === 'dark' || prefs?.theme === 'system'
      ? prefs.theme
      : 'system';

  return {
    emailDueReminders: prefs?.emailDueReminders ?? true,
    reminderWindowsDays: prefs?.reminderWindowsDays ?? [7, 3, 1],
    weeklySummary: prefs?.weeklySummary ?? false,
    incomeDay: prefs?.incomeDay ?? null,
    theme,
    ttsEnabled: prefs?.ttsEnabled ?? false,
    defaultCostCenterId: prefs?.defaultCostCenterId ?? null,
    defaultAccountId: prefs?.defaultAccountId ?? null,
    lookups: {
      centers: centers.map((center) => ({ id: center.id, name: center.name })),
      accounts: accs.map((account) => ({ id: account.id, name: account.name })),
    },
  };
}
