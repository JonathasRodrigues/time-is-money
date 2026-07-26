export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { and, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import { isDemoMode } from '@tim/mocks';
import {
  shouldPromptIncomeReceipt,
  shouldPromptPendingIncomes,
  suggestAverageAmountCents,
  yearMonthFromIso,
} from '@tim/domain';
import { transactions, userPreferences } from '@tim/db';
import { ensureSeriesInstancesForMonth } from '@tim/application';
import { AppShell } from '@/components/app-shell';
import { IncomeReceiptBanner } from '@/components/income-receipt-banner';
import { createAppContext } from '@/server/context';
import { getAuthSession, getDb } from '@/server/db';

function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith('pk_') && !key.includes('placeholder'));
}

function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const demo = isDemoMode();
  const configured = isClerkConfigured();
  const session = await getAuthSession();

  if (!demo) {
    if (configured && !session) {
      redirect('/sign-in');
    }
    if (session && !session.mfaEnabled && process.env.DEMO_BYPASS_MFA !== '1') {
      redirect('/mfa-required');
    }
  } else if (!session?.householdId) {
    redirect('/onboarding');
  }

  const userEmail = session?.email ?? (demo ? 'voce@demo.local' : 'usuario');
  const userLabel = demo ? 'Você (Admin)' : (userEmail.split('@')[0] ?? 'Usuário');

  let ttsEnabled = false;
  let incomeDay: number | null = null;
  let showGenericIncomePrompt = false;
  let pendingIncomes: Array<{
    id: string;
    description: string;
    dueOn: string;
    amountCents: number | null;
    suggestedCents: number | null;
  }> = [];
  let showSeriesIncomePrompt = false;

  if (session?.householdId) {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const yearMonth = yearMonthFromIso(today);
    const { start, end } = monthBounds(yearMonth);

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
    ttsEnabled = prefs?.ttsEnabled ?? false;
    incomeDay = prefs?.incomeDay ?? null;

    try {
      const ctx = await createAppContext();
      await ensureSeriesInstancesForMonth(ctx, yearMonth);
    } catch {
      // viewer ou falha — segue sem materializar
    }

    const pendingRows = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, session.householdId),
          isNull(transactions.deletedAt),
          eq(transactions.type, 'income'),
          eq(transactions.status, 'pending'),
          isNotNull(transactions.seriesId),
          gte(transactions.dueOn, start),
          lte(transactions.dueOn, end),
        ),
      );

    const history = await db
      .select({
        categoryId: transactions.categoryId,
        costCenterId: transactions.costCenterId,
        amountCents: transactions.amountCents,
        description: transactions.description,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, session.householdId),
          isNull(transactions.deletedAt),
          eq(transactions.type, 'income'),
          eq(transactions.status, 'paid'),
          isNotNull(transactions.amountCents),
        ),
      )
      .limit(300);

    pendingIncomes = pendingRows.map((row) => {
      const sameDesc = history
        .filter(
          (h) =>
            h.description === row.description &&
            h.categoryId === row.categoryId &&
            h.costCenterId === row.costCenterId &&
            h.amountCents != null,
        )
        .map((h) => h.amountCents as number);
      return {
        id: row.id,
        description: row.description ?? 'Receita',
        dueOn: row.dueOn ?? row.occurredOn,
        amountCents: row.amountCents,
        suggestedCents: suggestAverageAmountCents(sameDesc),
      };
    });

    showSeriesIncomePrompt = shouldPromptPendingIncomes({
      pendingCount: pendingIncomes.length,
      snoozedOn: prefs?.incomePromptSnoozedOn,
      todayIso: today,
    });

    showGenericIncomePrompt =
      !showSeriesIncomePrompt &&
      shouldPromptIncomeReceipt({
        incomeDay: prefs?.incomeDay,
        lastConfirmedMonth: prefs?.lastIncomeConfirmedMonth,
        snoozedOn: prefs?.incomePromptSnoozedOn,
        todayIso: today,
      });
  }

  const showBanner = showSeriesIncomePrompt || showGenericIncomePrompt;

  return (
    <AppShell demo={demo} userEmail={userEmail} userLabel={userLabel} ttsEnabled={ttsEnabled}>
      {showBanner ? (
        <IncomeReceiptBanner
          incomeDay={incomeDay}
          pendingIncomes={showSeriesIncomePrompt ? pendingIncomes : []}
        />
      ) : null}
      {children}
    </AppShell>
  );
}
