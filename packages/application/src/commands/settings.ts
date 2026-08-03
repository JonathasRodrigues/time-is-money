import { requireCapability, requireSession } from '@tim/auth';
import { accounts, categories, costCenters, creditCards, institutions } from '@tim/db';
import {
  defaultAllowedPaymentRails,
  normalizeAllowedPaymentRails,
  resolveBankCatalogName,
} from '@tim/domain';
import {
  createAccountSchema,
  createCategorySchema,
  createCostCenterSchema,
  createInstitutionSchema,
  setupBankSchema,
  updateAccountBalanceSchema,
  updateAccountSchema,
  updateInstitutionSchema,
} from '@tim/validators';
import { and, eq } from 'drizzle-orm';
import { syncCardInvoiceOpeningBalance } from '../card-invoices.js';
import type { AppContext } from '../context.js';
import {
  ensureAccountPaymentMethods,
  ensureCreditCardPaymentMethod,
  syncAccountPaymentMethods,
} from '../payment-methods.js';

export async function createCostCenter(ctx: AppContext, raw: unknown) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = createCostCenterSchema.parse({
    ...(raw as object),
    householdId: session.householdId,
  });
  await ctx.db.insert(costCenters).values(input);
}

export async function createCategory(ctx: AppContext, raw: unknown) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = createCategorySchema.parse({
    ...(raw as object),
    householdId: session.householdId,
  });
  await ctx.db.insert(categories).values({
    householdId: input.householdId,
    name: input.name,
    type: input.type,
    parentId: input.parentId ?? undefined,
  });
}

export async function createInstitution(ctx: AppContext, raw: unknown) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = createInstitutionSchema.parse({
    ...(raw as object),
    householdId: session.householdId,
  });
  await ctx.db.insert(institutions).values(input);
}

/**
 * Banco + conta corrente (+ poupança e cartão opcionais) em uma única operação.
 * O cartão já nasce atrelado ao banco e à corrente criada.
 */
export async function setupBank(ctx: AppContext, raw: unknown) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = setupBankSchema.parse({ ...(raw as object), householdId: session.householdId });
  const bankName = resolveBankCatalogName({
    catalogId: input.catalogId,
    customName: input.customName,
  });

  const [center] = await ctx.db
    .select({ id: costCenters.id })
    .from(costCenters)
    .where(
      and(eq(costCenters.id, input.costCenterId), eq(costCenters.householdId, session.householdId)),
    )
    .limit(1);
  if (!center) {
    throw new Error('Centro de custo inválido');
  }

  await ctx.db.transaction(async (tx) => {
    const [institution] = await tx
      .insert(institutions)
      .values({
        householdId: session.householdId,
        name: bankName,
      })
      .returning();
    if (!institution) {
      throw new Error('Falha ao criar banco');
    }

    const [account] = await tx
      .insert(accounts)
      .values({
        householdId: session.householdId,
        costCenterId: input.costCenterId,
        name: input.accountName,
        institutionId: institution.id,
        kind: 'checking',
        balanceCents: input.balanceCents,
        yieldType: 'none',
        yieldBps: null,
        allowedPaymentRails: defaultAllowedPaymentRails('checking'),
      })
      .returning();
    if (!account) {
      throw new Error('Falha ao criar conta corrente');
    }

    await ensureAccountPaymentMethods(tx, {
      householdId: session.householdId,
      accountId: account.id,
      kind: 'checking',
      rails: defaultAllowedPaymentRails('checking'),
    });

    if (input.includeSavings) {
      const [savings] = await tx
        .insert(accounts)
        .values({
          householdId: session.householdId,
          costCenterId: input.costCenterId,
          name: input.savingsName!.trim(),
          institutionId: institution.id,
          kind: 'savings',
          balanceCents: input.savingsBalanceCents,
          yieldType: 'none',
          yieldBps: null,
          allowedPaymentRails: defaultAllowedPaymentRails('savings'),
        })
        .returning();
      if (savings) {
        await ensureAccountPaymentMethods(tx, {
          householdId: session.householdId,
          accountId: savings.id,
          kind: 'savings',
          rails: defaultAllowedPaymentRails('savings'),
        });
      }
    }

    if (input.includeCreditCard) {
      const isDebitOnly = input.cardMode === 'debit';
      const [card] = await tx
        .insert(creditCards)
        .values({
          householdId: session.householdId,
          institutionId: institution.id,
          paymentAccountId: account.id,
          name: input.cardName!.trim(),
          cardMode: input.cardMode,
          lastFour: input.cardLastFour ?? null,
          creditLimitCents: isDebitOnly ? 0 : input.creditLimitCents,
          invoiceBalanceCents: isDebitOnly ? 0 : input.invoiceBalanceCents,
          closingDay: isDebitOnly ? 1 : input.closingDay,
          dueDay: isDebitOnly ? 1 : input.dueDay,
        })
        .returning();

      if (card) {
        await ensureCreditCardPaymentMethod(tx, {
          householdId: session.householdId,
          creditCardId: card.id,
          paymentAccountId: account.id,
          cardMode: input.cardMode,
        });
        if (!isDebitOnly && input.invoiceBalanceCents > 0) {
          const today = new Date().toISOString().slice(0, 10);
          await syncCardInvoiceOpeningBalance(tx, {
            householdId: session.householdId,
            userId: session.userId,
            card,
            targetBalanceCents: input.invoiceBalanceCents,
            purchaseOn: today,
          });
        }
      }
    }
  });
}

export async function updateInstitution(ctx: AppContext, institutionId: string, raw: unknown) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = updateInstitutionSchema.parse({
    ...(raw as object),
    institutionId,
    householdId: session.householdId,
  });
  const [updated] = await ctx.db
    .update(institutions)
    .set({ name: input.name })
    .where(
      and(
        eq(institutions.id, input.institutionId),
        eq(institutions.householdId, session.householdId),
      ),
    )
    .returning();
  if (!updated) {
    throw new Error('Banco não encontrado');
  }
}

export async function createAccount(ctx: AppContext, raw: unknown): Promise<{ id: string }> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = createAccountSchema.parse({ ...(raw as object), householdId: session.householdId });
  const allowedPaymentRails =
    input.allowedPaymentRails !== undefined
      ? normalizeAllowedPaymentRails(input.allowedPaymentRails)
      : defaultAllowedPaymentRails(input.kind);
  const [created] = await ctx.db
    .insert(accounts)
    .values({
      householdId: input.householdId,
      costCenterId: input.costCenterId,
      name: input.name,
      institutionId: input.institutionId ?? null,
      parentAccountId: input.parentAccountId ?? null,
      kind: input.kind,
      balanceCents: input.balanceCents,
      yieldType: input.yieldType,
      yieldBps: input.yieldBps ?? null,
      allowedPaymentRails,
    })
    .returning();
  if (!created) {
    throw new Error('Falha ao criar conta');
  }
  await ensureAccountPaymentMethods(ctx.db, {
    householdId: input.householdId,
    accountId: created.id,
    kind: input.kind,
    rails: allowedPaymentRails,
  });
  return { id: created.id };
}

export async function updateAccount(ctx: AppContext, accountId: string, raw: unknown) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = updateAccountSchema.parse({
    ...(raw as object),
    accountId,
    householdId: session.householdId,
  });

  if (input.parentAccountId === input.accountId) {
    throw new Error('Uma conta não pode ser pai de si mesma');
  }

  const [updated] = await ctx.db
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
      allowedPaymentRails: normalizeAllowedPaymentRails(input.allowedPaymentRails),
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, input.accountId), eq(accounts.householdId, session.householdId)))
    .returning();
  if (!updated) {
    throw new Error('Conta não encontrada');
  }

  await syncAccountPaymentMethods(ctx.db, {
    householdId: session.householdId,
    accountId: input.accountId,
    rails: normalizeAllowedPaymentRails(input.allowedPaymentRails),
  });
}

export async function updateAccountBalance(ctx: AppContext, accountId: string, raw: unknown) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = updateAccountBalanceSchema.parse({
    ...(raw as object),
    accountId,
    householdId: session.householdId,
  });
  await ctx.db
    .update(accounts)
    .set({ balanceCents: input.balanceCents, updatedAt: new Date() })
    .where(and(eq(accounts.id, input.accountId), eq(accounts.householdId, session.householdId)));
}
