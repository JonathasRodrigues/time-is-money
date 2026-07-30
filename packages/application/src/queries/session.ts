import { can, requireSession } from '@tim/auth';
import type { BootstrapResponse, IncomePromptResponse, MeResponse } from '@tim/api-contract';
import {
  shouldPromptIncomeReceipt,
  shouldPromptPendingIncomes,
  suggestAverageAmountCents,
  yearMonthFromIso,
} from '@tim/domain';
import { accounts, categories, costCenters, transactions, userPreferences } from '@tim/db';
import { listCapabilities } from '@tim/permissions';
import { and, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import type { AppContext } from '../context';
import { listHouseholdMembers, listPendingHouseholdInvites } from '../members';
import type { MembersResponse } from '@tim/api-contract';

function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function buildMeResponse(ctx: AppContext): MeResponse {
  const session = requireSession(ctx.session);
  return {
    userId: session.userId,
    email: session.email,
    householdId: session.householdId,
    role: session.role,
    mfaEnabled: session.mfaEnabled,
    canManageMembers: can(session, 'members.manage'),
    capabilities: listCapabilities(session.role),
  };
}

export async function loadBootstrap(ctx: AppContext): Promise<BootstrapResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
  const [prefs, centers, accs, cats] = await Promise.all([
    db
      .select()
      .from(userPreferences)
      .where(
        and(
          eq(userPreferences.householdId, session.householdId),
          eq(userPreferences.userId, session.userId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ id: costCenters.id, name: costCenters.name })
      .from(costCenters)
      .where(eq(costCenters.householdId, session.householdId)),
    db
      .select({
        id: accounts.id,
        name: accounts.name,
        isArchived: accounts.isArchived,
      })
      .from(accounts)
      .where(eq(accounts.householdId, session.householdId)),
    db
      .select({
        id: categories.id,
        name: categories.name,
        type: categories.type,
      })
      .from(categories)
      .where(eq(categories.householdId, session.householdId)),
  ]);

  const theme =
    prefs?.theme === 'light' || prefs?.theme === 'dark' || prefs?.theme === 'system'
      ? prefs.theme
      : 'system';

  return {
    ttsEnabled: prefs?.ttsEnabled ?? false,
    theme,
    incomeDay: prefs?.incomeDay ?? null,
    costCenters: centers,
    accounts: accs.map((a) => ({
      id: a.id,
      name: a.name,
      isArchived: a.isArchived,
    })),
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as 'income' | 'expense',
    })),
  };
}

export async function loadIncomePrompt(ctx: AppContext): Promise<IncomePromptResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
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

  const [pendingRows, history, householdAccounts] = await Promise.all([
    db
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
      ),
    db
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
      .limit(300),
    db
      .select({ id: accounts.id, name: accounts.name, isArchived: accounts.isArchived })
      .from(accounts)
      .where(eq(accounts.householdId, session.householdId)),
  ]);

  const pendingIncomes = pendingRows.map((row) => {
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
      accountId: row.accountId,
      amountCents: row.amountCents,
      suggestedCents: suggestAverageAmountCents(sameDesc),
    };
  });

  const pendingAccountIds = new Set(pendingIncomes.map((row) => row.accountId));
  const incomeAccounts = householdAccounts
    .filter((a) => !a.isArchived || pendingAccountIds.has(a.id))
    .map((a) => ({ id: a.id, name: a.name }));

  const showSeries = shouldPromptPendingIncomes({
    pendingCount: pendingIncomes.length,
    snoozedOn: prefs?.incomePromptSnoozedOn,
    todayIso: today,
  });

  const showGeneric =
    !showSeries &&
    shouldPromptIncomeReceipt({
      incomeDay: prefs?.incomeDay,
      lastConfirmedMonth: prefs?.lastIncomeConfirmedMonth,
      snoozedOn: prefs?.incomePromptSnoozedOn,
      todayIso: today,
    });

  const mode = showSeries ? 'series' : showGeneric ? 'generic' : 'none';

  return {
    show: mode !== 'none',
    mode,
    incomeDay: prefs?.incomeDay ?? null,
    pendingIncomes: showSeries ? pendingIncomes : [],
    accounts: incomeAccounts,
    yearMonth,
  };
}

export async function loadMembers(ctx: AppContext): Promise<MembersResponse> {
  const session = requireSession(ctx.session);
  const [members, invites] = await Promise.all([
    listHouseholdMembers(ctx),
    listPendingHouseholdInvites(ctx),
  ]);

  return {
    currentUserId: session.userId,
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      email: member.email,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
      isSelf: member.userId === session.userId,
    })),
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    })),
  };
}
