'use server';

import {
  createTransaction,
  createFinancing,
  payInstallmentWithCategory,
  payInstallmentsBulk,
  rebuildFinancing,
  softDeleteFinancing,
  createPendingTransaction,
  createMonthlySeries,
  payTransaction,
  payTransactionsBulk,
  updatePendingAmount,
  ensureSeriesInstancesForMonth,
  createTransfer,
} from '@tim/application';
import {
  accounts,
  categories,
  costCenters,
  households,
  institutions,
  memberships,
  seedHouseholdDefaults,
  transactions,
  userPreferences,
} from '@tim/db';
import {
  createAccountSchema,
  createInstitutionSchema,
  createCostCenterSchema,
  createCategorySchema,
  createFinancingSchema,
  createMonthlySeriesSchema,
  createPendingTransactionSchema,
  createTransactionSchema,
  createTransferSchema,
  notificationPrefsSchema,
  payTransactionSchema,
  transactionTypeSchema,
  updateAccountBalanceSchema,
  updateAccountSchema,
  updateInstitutionSchema,
  updatePendingAmountSchema,
} from '@tim/validators';
import { requireCapability, requireSession } from '@tim/auth';
import { auth, currentUser } from '@clerk/nextjs/server';
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAppContext } from '@/server/context';
import { getAuthSession, getDb } from '@/server/db';

/** Uma revalidação de layout cobre as páginas do app — mais rápido que N revalidatePath. */
function revalidateApp(): void {
  revalidatePath('/', 'layout');
}

export async function createHouseholdAction(name: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Não autenticado');
  const user = await currentUser();
  const db = getDb();

  const [household] = await db
    .insert(households)
    .values({ name: name.trim() || 'Minha casa' })
    .returning();
  if (!household) throw new Error('Falha ao criar household');

  await db.insert(memberships).values({
    householdId: household.id,
    userId,
    email: user?.primaryEmailAddress?.emailAddress,
    role: 'admin',
  });

  await seedHouseholdDefaults(db, household.id);

  await db.insert(userPreferences).values({
    householdId: household.id,
    userId,
  });

  revalidateApp();
  return { householdId: household.id };
}

export async function createTransactionAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const status = String(formData.get('status') || 'paid');
  const dateRaw = String(formData.get('date') || formData.get('occurredOn') || '');
  const parsed = createTransactionSchema.parse({
    householdId: session.householdId,
    costCenterId: String(formData.get('costCenterId')),
    categoryId: String(formData.get('categoryId')),
    accountId: String(formData.get('accountId')),
    type: String(formData.get('type')),
    status,
    amountCents: Math.round(Number(formData.get('amount')) * 100),
    // Pago: data do pagamento/recebimento. Pendente: data de vencimento.
    occurredOn: dateRaw,
    dueOn: dateRaw,
    description: String(formData.get('description') || '') || undefined,
    notes: String(formData.get('notes') || '') || undefined,
  });
  await createTransaction(ctx, parsed, 'manual');
  revalidateApp();
}

export async function createCostCenterAction(formData: FormData) {
  const session = requireSession(await getAuthSession());
  requireCapability(session, 'settings.write');
  const input = createCostCenterSchema.parse({
    householdId: session.householdId,
    name: String(formData.get('name')),
    color: String(formData.get('color') || '') || undefined,
  });
  const db = getDb();
  await db.insert(costCenters).values(input);
  revalidateApp();
}

export async function createCategoryAction(formData: FormData) {
  const session = requireSession(await getAuthSession());
  requireCapability(session, 'settings.write');
  const input = createCategorySchema.parse({
    householdId: session.householdId,
    name: String(formData.get('name')),
    type: String(formData.get('type')),
    parentId: formData.get('parentId') ? String(formData.get('parentId')) : null,
  });
  const db = getDb();
  await db.insert(categories).values({
    householdId: input.householdId,
    name: input.name,
    type: input.type,
    parentId: input.parentId ?? undefined,
  });
  revalidateApp();
}

export async function createInstitutionAction(formData: FormData) {
  const session = requireSession(await getAuthSession());
  requireCapability(session, 'settings.write');
  const input = createInstitutionSchema.parse({
    householdId: session.householdId,
    name: String(formData.get('name')),
  });
  const db = getDb();
  await db.insert(institutions).values(input);
  revalidateApp();
}

export async function updateInstitutionAction(formData: FormData) {
  const session = requireSession(await getAuthSession());
  requireCapability(session, 'settings.write');
  const input = updateInstitutionSchema.parse({
    householdId: session.householdId,
    institutionId: String(formData.get('institutionId')),
    name: String(formData.get('name')),
  });
  const db = getDb();
  const [updated] = await db
    .update(institutions)
    .set({ name: input.name })
    .where(
      and(
        eq(institutions.id, input.institutionId),
        eq(institutions.householdId, session.householdId),
      ),
    )
    .returning();
  if (!updated) throw new Error('Banco não encontrado');
  revalidateApp();
}

function parseAccountFormFields(formData: FormData): {
  kind: 'cash' | 'checking' | 'investment_pot';
  yieldType: 'none' | 'cdi' | 'fixed_annual';
  yieldBps: number | null;
  balanceCents: number;
  institutionId: string | null;
  parentAccountId: string | null;
  name: string;
  costCenterId: string;
} {
  const balanceRaw = String(formData.get('balance') || '').trim();
  const yieldRaw = String(formData.get('yieldValue') || '').trim();
  const yieldTypeRaw = String(formData.get('yieldType') || 'none');
  const yieldType =
    yieldTypeRaw === 'cdi' || yieldTypeRaw === 'fixed_annual' ? yieldTypeRaw : 'none';
  const kindRaw = String(formData.get('kind') || 'checking');
  const kind =
    kindRaw === 'cash' || kindRaw === 'investment_pot' || kindRaw === 'checking'
      ? kindRaw
      : 'checking';

  let yieldBps: number | null = null;
  if (yieldType !== 'none' && yieldRaw !== '') {
    const numeric = Number(yieldRaw.replace(',', '.'));
    yieldBps = Math.round(numeric * 100);
  }

  return {
    kind,
    yieldType,
    yieldBps,
    balanceCents: balanceRaw === '' ? 0 : Math.round(Number(balanceRaw.replace(',', '.')) * 100),
    institutionId: formData.get('institutionId') ? String(formData.get('institutionId')) : null,
    parentAccountId: formData.get('parentAccountId')
      ? String(formData.get('parentAccountId'))
      : null,
    name: String(formData.get('name')),
    costCenterId: String(formData.get('costCenterId')),
  };
}

export async function createAccountAction(formData: FormData) {
  const session = requireSession(await getAuthSession());
  requireCapability(session, 'settings.write');
  const fields = parseAccountFormFields(formData);
  const input = createAccountSchema.parse({
    householdId: session.householdId,
    ...fields,
  });
  const db = getDb();
  await db.insert(accounts).values({
    householdId: input.householdId,
    costCenterId: input.costCenterId,
    name: input.name,
    institutionId: input.institutionId ?? null,
    parentAccountId: input.parentAccountId ?? null,
    kind: input.kind,
    balanceCents: input.balanceCents,
    yieldType: input.yieldType,
    yieldBps: input.yieldBps ?? null,
  });
  revalidateApp();
}

export async function updateAccountAction(formData: FormData) {
  const session = requireSession(await getAuthSession());
  requireCapability(session, 'settings.write');
  const fields = parseAccountFormFields(formData);
  const input = updateAccountSchema.parse({
    householdId: session.householdId,
    accountId: String(formData.get('accountId')),
    ...fields,
  });

  if (input.parentAccountId === input.accountId) {
    throw new Error('Uma conta não pode ser pai de si mesma');
  }

  const db = getDb();
  const [updated] = await db
    .update(accounts)
    .set({
      costCenterId: input.costCenterId,
      name: input.name,
      institutionId: input.institutionId ?? null,
      parentAccountId: input.parentAccountId ?? null,
      kind: input.kind,
      balanceCents: input.balanceCents,
      yieldType: input.yieldType,
      yieldBps: input.yieldType === 'none' ? null : (input.yieldBps ?? null),
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, input.accountId), eq(accounts.householdId, session.householdId)))
    .returning();
  if (!updated) throw new Error('Conta não encontrada');
  revalidateApp();
}

export async function updateAccountBalanceAction(formData: FormData) {
  const session = requireSession(await getAuthSession());
  requireCapability(session, 'settings.write');
  const input = updateAccountBalanceSchema.parse({
    householdId: session.householdId,
    accountId: String(formData.get('accountId')),
    balanceCents: Math.round(
      Number(String(formData.get('balance') || '0').replace(',', '.')) * 100,
    ),
  });
  const db = getDb();
  await db
    .update(accounts)
    .set({ balanceCents: input.balanceCents, updatedAt: new Date() })
    .where(and(eq(accounts.id, input.accountId), eq(accounts.householdId, session.householdId)));
  revalidateApp();
}

export async function createTransferAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const amountRaw = String(formData.get('amount') || '');
  const descriptionRaw = String(formData.get('description') || '');
  const parsed = createTransferSchema.parse({
    householdId: session.householdId,
    fromAccountId: String(formData.get('fromAccountId')),
    toAccountId: String(formData.get('toAccountId')),
    amountCents: Math.round(Number(amountRaw.replace(',', '.')) * 100),
    occurredOn: String(formData.get('occurredOn')),
    description: descriptionRaw === '' ? undefined : descriptionRaw,
  });
  await createTransfer(ctx, parsed);
  revalidateApp();
}

export async function createFinancingAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const systemRaw = String(formData.get('amortizationSystem') || 'fixed');
  const amortizationSystem =
    systemRaw === 'price' || systemRaw === 'sac' || systemRaw === 'fixed' ? systemRaw : 'fixed';
  const installmentRaw = String(formData.get('installmentAmount') || '');
  const rateRaw = String(formData.get('annualRate') || '');
  const parsed = createFinancingSchema.parse({
    householdId: session.householdId,
    costCenterId: String(formData.get('costCenterId')),
    accountId: String(formData.get('accountId')),
    name: String(formData.get('name')),
    institution: String(formData.get('institution') || '') || undefined,
    principalCents: Math.round(Number(formData.get('principal')) * 100),
    installmentCount: Number(formData.get('installmentCount')),
    installmentAmountCents:
      installmentRaw === '' ? undefined : Math.round(Number(installmentRaw) * 100),
    firstDueOn: String(formData.get('firstDueOn')),
    annualRateBps: rateRaw === '' ? undefined : Math.round(Number(rateRaw.replace(',', '.')) * 100),
    amortizationSystem,
  });
  await createFinancing(ctx, parsed);
  revalidateApp();
}

export async function payInstallmentAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const amountRaw = String(formData.get('amount') || '');
  const extraRaw = String(formData.get('extraAmortization') || '');
  await payInstallmentWithCategory(ctx, {
    householdId: session.householdId,
    installmentId: String(formData.get('installmentId')),
    paidOn: String(formData.get('paidOn')),
    categoryId: String(formData.get('categoryId') || '') || undefined,
    amountCents:
      amountRaw === '' ? undefined : Math.round(Number(amountRaw.replace(',', '.')) * 100),
    extraAmortizationCents:
      extraRaw === '' ? undefined : Math.round(Number(extraRaw.replace(',', '.')) * 100),
  });
  revalidateApp();
}

export async function payInstallmentsBulkAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const ids = formData.getAll('installmentId').map(String);
  const amounts = formData.getAll('amount').map(String);
  if (ids.length === 0) throw new Error('Selecione ao menos uma parcela');
  const items = ids.map((installmentId, index) => ({
    installmentId,
    amountCents: Math.round(Number((amounts[index] ?? '0').replace(',', '.')) * 100),
  }));
  await payInstallmentsBulk(ctx, {
    householdId: session.householdId,
    paidOn: String(formData.get('paidOn')),
    categoryId: String(formData.get('categoryId') || '') || undefined,
    items,
  });
  revalidateApp();
}

export async function rebuildFinancingAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const systemRaw = String(formData.get('amortizationSystem') || 'fixed');
  const amortizationSystem =
    systemRaw === 'price' || systemRaw === 'sac' || systemRaw === 'fixed' ? systemRaw : 'fixed';
  const installmentRaw = String(formData.get('installmentAmount') || '');
  const rateRaw = String(formData.get('annualRate') || '');
  await rebuildFinancing(ctx, {
    householdId: session.householdId,
    financingId: String(formData.get('financingId')),
    name: String(formData.get('name')),
    institution: String(formData.get('institution') || '') || undefined,
    principalCents: Math.round(Number(String(formData.get('principal')).replace(',', '.')) * 100),
    installmentCount: Number(formData.get('installmentCount')),
    installmentAmountCents:
      installmentRaw === ''
        ? undefined
        : Math.round(Number(installmentRaw.replace(',', '.')) * 100),
    firstDueOn: String(formData.get('firstDueOn')),
    annualRateBps: rateRaw === '' ? undefined : Math.round(Number(rateRaw.replace(',', '.')) * 100),
    amortizationSystem,
  });
  revalidateApp();
}

export async function deleteFinancingAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  await softDeleteFinancing(ctx, {
    householdId: session.householdId,
    financingId: String(formData.get('financingId')),
  });
  revalidateApp();
}

export async function createPendingTransactionAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const amountRaw = String(formData.get('amount') || '');
  const installmentsRaw = String(formData.get('installmentCount') || '1');
  const installmentCount = Math.max(1, Math.min(48, Number(installmentsRaw) || 1));
  const parsed = createPendingTransactionSchema.parse({
    householdId: session.householdId,
    costCenterId: String(formData.get('costCenterId')),
    categoryId: String(formData.get('categoryId')),
    accountId: String(formData.get('accountId')),
    type: 'expense',
    amountCents: amountRaw === '' ? null : Math.round(Number(amountRaw) * 100),
    dueOn: String(formData.get('dueOn')),
    description: String(formData.get('description')),
    installmentCount,
  });
  await createPendingTransaction(ctx, parsed, 'manual');
  revalidateApp();
}

export async function createMonthlySeriesAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const amountRaw = String(formData.get('defaultAmount') || '');
  const typeRaw = String(formData.get('type') || 'expense');
  const parsed = createMonthlySeriesSchema.parse({
    householdId: session.householdId,
    costCenterId: String(formData.get('costCenterId')),
    categoryId: String(formData.get('categoryId')),
    accountId: String(formData.get('accountId')),
    type: transactionTypeSchema.parse(typeRaw),
    description: String(formData.get('description')),
    dueDay: Number(formData.get('dueDay')),
    defaultAmountCents: amountRaw === '' ? null : Math.round(Number(amountRaw) * 100),
  });
  await createMonthlySeries(ctx, parsed);
  revalidateApp();
}

export async function payTransactionAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const amountRaw = String(formData.get('amount') || '');
  const parsed = payTransactionSchema.parse({
    householdId: session.householdId,
    transactionId: String(formData.get('transactionId')),
    paidOn: String(formData.get('paidOn')),
    amountCents: amountRaw === '' ? undefined : Math.round(Number(amountRaw) * 100),
  });
  await payTransaction(ctx, parsed);
  revalidateApp();
}

export async function payTransactionsBulkAction(input: {
  paidOn: string;
  items: Array<{ transactionId: string; amountCents?: number }>;
}) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  await payTransactionsBulk(ctx, {
    householdId: session.householdId,
    paidOn: input.paidOn,
    items: input.items,
  });
  revalidateApp();
}

export async function updatePendingAmountAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const amountRaw = String(formData.get('amount') || '');
  const parsed = updatePendingAmountSchema.parse({
    householdId: session.householdId,
    transactionId: String(formData.get('transactionId')),
    amountCents: amountRaw === '' ? null : Math.round(Number(amountRaw) * 100),
  });
  await updatePendingAmount(ctx, parsed);
  revalidateApp();
}

export async function ensurePaymentInstancesAction() {
  const ctx = await createAppContext();
  await ensureSeriesInstancesForMonth(ctx);
  revalidateApp();
}

export async function confirmIncomeReceiptAction() {
  const session = requireSession(await getAuthSession());
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  await db
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
  revalidateApp();
  redirect('/payments?payday=1');
}

export async function confirmIncomeItemAction(formData: FormData) {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  const amountRaw = String(formData.get('amount') || '');
  const paidOn = String(formData.get('paidOn') || new Date().toISOString().slice(0, 10));
  await payTransaction(ctx, {
    householdId: session.householdId,
    transactionId: String(formData.get('transactionId')),
    paidOn,
    amountCents: Math.round(Number(amountRaw.replace(',', '.')) * 100),
  });

  const db = getDb();
  const today = paidOn;
  const yearMonth = today.slice(0, 7);
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  const remaining = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        eq(transactions.type, 'income'),
        eq(transactions.status, 'pending'),
        isNotNull(transactions.seriesId),
        gte(transactions.dueOn, start),
        lte(transactions.dueOn, end),
      ),
    )
    .limit(1);

  if (remaining.length === 0) {
    await db
      .update(userPreferences)
      .set({
        lastIncomeConfirmedMonth: yearMonth,
        incomePromptSnoozedOn: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userPreferences.householdId, session.householdId),
          eq(userPreferences.userId, session.userId),
        ),
      );
    revalidateApp();
    redirect('/payments?payday=1');
  }

  revalidateApp();
}

export async function snoozeIncomeReceiptAction() {
  const session = requireSession(await getAuthSession());
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  await db
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
  revalidateApp();
}

export async function updatePreferencesAction(formData: FormData) {
  const session = requireSession(await getAuthSession());
  const prefs = notificationPrefsSchema.parse({
    emailDueReminders: formData.get('emailDueReminders') === 'on',
    windowsDays: String(formData.get('windowsDays') || '7,3,1')
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => !Number.isNaN(n)),
    weeklySummary: formData.get('weeklySummary') === 'on',
  });
  const incomeDayRaw = String(formData.get('incomeDay') || '').trim();
  const incomeDay =
    incomeDayRaw === '' ? null : Math.min(28, Math.max(1, Math.floor(Number(incomeDayRaw))));
  const db = getDb();
  await db
    .update(userPreferences)
    .set({
      emailDueReminders: prefs.emailDueReminders,
      reminderWindowsDays: prefs.windowsDays,
      weeklySummary: prefs.weeklySummary ?? false,
      ttsEnabled: formData.get('ttsEnabled') === 'on',
      incomeDay: Number.isFinite(incomeDay) ? incomeDay : null,
      defaultCostCenterId: formData.get('defaultCostCenterId')
        ? String(formData.get('defaultCostCenterId'))
        : null,
      defaultAccountId: formData.get('defaultAccountId')
        ? String(formData.get('defaultAccountId'))
        : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userPreferences.householdId, session.householdId),
        eq(userPreferences.userId, session.userId),
      ),
    );
  revalidateApp();
}
