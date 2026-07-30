import { requireSession } from '@tim/auth';
import { userPreferences } from '@tim/db';
import {
  themePreferenceSchema,
  updatePreferencesSchema,
  type UpdatePreferencesInput,
} from '@tim/validators';
import { and, eq } from 'drizzle-orm';
import type { AppContext } from '../context.js';

export async function updatePreferences(
  ctx: AppContext,
  raw: UpdatePreferencesInput,
): Promise<void> {
  const session = requireSession(ctx.session);
  const prefs = updatePreferencesSchema.parse(raw);
  const theme = themePreferenceSchema.parse(prefs.theme);
  const incomeDay = prefs.incomeDay ?? null;

  await ctx.db
    .update(userPreferences)
    .set({
      emailDueReminders: prefs.emailDueReminders,
      reminderWindowsDays: prefs.windowsDays,
      weeklySummary: prefs.weeklySummary ?? false,
      ttsEnabled: prefs.ttsEnabled ?? false,
      theme,
      incomeDay: incomeDay != null && Number.isFinite(incomeDay) ? incomeDay : null,
      defaultCostCenterId: prefs.defaultCostCenterId ?? null,
      defaultAccountId: prefs.defaultAccountId ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userPreferences.householdId, session.householdId),
        eq(userPreferences.userId, session.userId),
      ),
    );
}

export async function updateThemePreference(ctx: AppContext, themeRaw: string): Promise<void> {
  const session = requireSession(ctx.session);
  if (!session.householdId) return;
  const theme = themePreferenceSchema.parse(themeRaw);
  await ctx.db
    .update(userPreferences)
    .set({ theme, updatedAt: new Date() })
    .where(
      and(
        eq(userPreferences.householdId, session.householdId),
        eq(userPreferences.userId, session.userId),
      ),
    );
}

export async function confirmIncomeReceipt(ctx: AppContext): Promise<{ redirectTo?: string }> {
  const session = requireSession(ctx.session);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  await ctx.db
    .update(userPreferences)
    .set({
      lastIncomeConfirmedMonth: month,
      incomePromptSnoozedOn: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userPreferences.householdId, session.householdId),
        eq(userPreferences.userId, session.userId),
      ),
    );
  return { redirectTo: '/payments?flow=receive&payday=1' };
}

export async function snoozeIncomeReceipt(ctx: AppContext): Promise<void> {
  const session = requireSession(ctx.session);
  const today = new Date().toISOString().slice(0, 10);
  await ctx.db
    .update(userPreferences)
    .set({
      incomePromptSnoozedOn: today,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userPreferences.householdId, session.householdId),
        eq(userPreferences.userId, session.userId),
      ),
    );
}
