import type { AuthSession } from '@tim/auth';
import { requireCapability, requireSession } from '@tim/auth';
import { encryptSensitiveField } from '@tim/crypto';
import type { Database, DbClient } from '@tim/db';
import {
  accountTransfers,
  accounts,
  auditLogs,
  categories,
  costCenters,
  creditCardInvoices,
  creditCards,
  financings,
  installments,
  institutions,
  planItems,
  planContributions,
  plans,
  transactionSeries,
  transactions,
  userPreferences,
} from '@tim/db';
import {
  accountAllowsPaymentRail,
  assertAccountDebitBalance,
  assertCardPurchase,
  assertPayInvoice,
  assertTransferAllowed,
  addMonths,
  buildAmortizationSchedule,
  cardHasCredit,
  coerceAllowedPaymentRails,
  paymentMethodMovesAccountBalance,
  dueOnForMonth,
  rebuildRemainingSchedule,
  shiftYearMonth,
  yearMonthFromIso,
  type AmortizationSystem,
} from '@tim/domain';
import type {
  CreateCreditCardInput,
  CreateFinancingInput,
  CreateMonthlySeriesInput,
  CreatePendingTransactionInput,
  CreatePlanInput,
  CreateTransactionInput,
  CreateTransferInput,
  PayCreditCardInvoiceInput,
  PayInstallmentInput,
  PayInstallmentsBulkInput,
  PayTransactionInput,
  PayTransactionsBulkInput,
  RebuildFinancingInput,
  SoftDeleteFinancingInput,
  SoftDeletePlanInput,
  SoftDeleteTransactionInput,
  UpdateCreditCardInput,
  UpdatePendingAmountInput,
  UpdatePlanInput,
  UpsertPlanItemsInput,
  UpsertPlanContributionsInput,
  UpdateTransactionInput,
} from '@tim/validators';
import {
  createCreditCardSchema,
  createFinancingSchema,
  createMonthlySeriesSchema,
  createPendingTransactionSchema,
  createPlanSchema,
  createTransactionSchema,
  createTransferSchema,
  payCreditCardInvoiceSchema,
  payInstallmentSchema,
  payInstallmentsBulkSchema,
  payTransactionSchema,
  payTransactionsBulkSchema,
  rebuildFinancingSchema,
  softDeleteFinancingSchema,
  softDeletePlanSchema,
  softDeleteTransactionSchema,
  updateCreditCardSchema,
  updatePendingAmountSchema,
  updatePlanSchema,
  upsertPlanItemsSchema,
  upsertPlanContributionsSchema,
  updateTransactionSchema,
} from '@tim/validators';
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, ne } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { AppContext } from './context';
import {
  getOrCreateInvoiceForPurchase,
  refreshCardInvoiceBalanceCache,
  sumInvoiceBalanceCents,
  syncCardInvoiceOpeningBalance,
} from './card-invoices';
import {
  ensureCreditCardPaymentMethod,
  findAccountPaymentMethod,
  findCreditCardPaymentMethod,
  getPaymentMethodById,
} from './payment-methods';

async function resolvePaymentMethodId(
  db: DbClient,
  householdId: string,
  input: {
    paymentMethodId?: string | null;
    accountId?: string | null;
    creditCardId?: string | null;
    paymentRail?: string | null;
  },
): Promise<string | null> {
  if (input.paymentMethodId) {
    const byId = await getPaymentMethodById(db, householdId, input.paymentMethodId);
    if (byId) return byId.id;
  }
  if (input.creditCardId) {
    const byCard = await findCreditCardPaymentMethod(db, householdId, input.creditCardId);
    if (byCard) return byCard.id;
  }
  if (input.accountId) {
    const byAccount = await findAccountPaymentMethod(
      db,
      householdId,
      input.accountId,
      input.paymentRail,
    );
    if (byAccount) return byAccount.id;
  }
  return null;
}

export type { AppContext } from './context';
export {
  closeDueCreditCardInvoices,
  getOrCreateInvoiceForPurchase,
  linkOrphanCardPurchasesToInvoices,
  materializeLegacyCardInvoiceBalances,
  refreshCardInvoiceBalanceCache,
  syncCardInvoiceOpeningBalance,
} from './card-invoices';

function duplicateHash(input: {
  occurredOn: string;
  amountCents: number | null | undefined;
  description?: string;
  accountId: string;
}): string {
  return createHash('sha256')
    .update(
      `${input.occurredOn}|${input.amountCents ?? 'null'}|${input.description ?? ''}|${input.accountId}`,
    )
    .digest('hex');
}

export async function writeAudit(
  ctx: AppContext,
  input: {
    action: string;
    resourceType: string;
    resourceId?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const session = requireSession(ctx.session);
  await ctx.db.insert(auditLogs).values({
    householdId: session.householdId,
    userId: session.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    source: input.source ?? 'app',
    metadata: input.metadata ?? {},
  });
}

export async function createTransaction(
  ctx: AppContext,
  raw: CreateTransactionInput,
  source = 'manual',
) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = createTransactionSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  if (input.householdId !== session.householdId) {
    throw new Error('household mismatch');
  }

  const notesEncrypted = input.notes
    ? encryptSensitiveField(input.notes, ctx.encryptionSecret, session.householdId)
    : null;

  const status = input.status ?? 'paid';
  const isPaid = status === 'paid';
  const dueOn = input.dueOn ?? input.occurredOn;
  const creditCardId = input.creditCardId ?? null;
  if (creditCardId && !isPaid) {
    throw new Error(
      'Compra no cartão deve ser registrada como já paga — entra na fatura do ciclo, não em contas a pagar.',
    );
  }
  const paymentRail = creditCardId ? null : (input.paymentRail ?? null);

  let resolvedAccountId = input.accountId;
  let creditCardInvoiceId: string | null = null;

  if (creditCardId) {
    const [card] = await ctx.db
      .select()
      .from(creditCards)
      .where(
        and(eq(creditCards.id, creditCardId), eq(creditCards.householdId, session.householdId)),
      )
      .limit(1);
    if (!card) {
      throw new Error('Cartão inválido');
    }
    assertCardPurchase({
      type: input.type,
      amountCents: input.amountCents,
      cardArchived: card.isArchived,
    });
    if (!cardHasCredit(card.cardMode)) {
      throw new Error('Cartão não possui crédito');
    }
    resolvedAccountId = card.paymentAccountId;
  } else {
    const [account] = await ctx.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, input.accountId), eq(accounts.householdId, session.householdId)))
      .limit(1);
    if (!account) {
      throw new Error('Conta inválida');
    }
  }

  const row = await ctx.db.transaction(async (dbTx) => {
    if (creditCardId && isPaid && input.type === 'expense') {
      const [card] = await dbTx
        .select()
        .from(creditCards)
        .where(
          and(eq(creditCards.id, creditCardId), eq(creditCards.householdId, session.householdId)),
        )
        .limit(1)
        .for('update');
      if (!card) {
        throw new Error('Cartão inválido');
      }
      const invoice = await getOrCreateInvoiceForPurchase(dbTx, {
        householdId: session.householdId,
        card,
        purchaseOn: input.occurredOn,
      });
      creditCardInvoiceId = invoice.id;
    }

    const movesBalance =
      isPaid &&
      !creditCardId &&
      paymentMethodMovesAccountBalance({
        type: 'account',
        paymentRail: paymentRail ?? 'pix',
      });

    if (movesBalance) {
      const [locked] = await dbTx
        .select()
        .from(accounts)
        .where(
          and(eq(accounts.id, resolvedAccountId), eq(accounts.householdId, session.householdId)),
        )
        .limit(1)
        .for('update');
      if (!locked) {
        throw new Error('Conta inválida');
      }
      if (locked.isArchived) {
        throw new Error('Conta está arquivada');
      }
      const delta = input.type === 'expense' ? -input.amountCents : input.amountCents;
      if (delta < 0) {
        assertAccountDebitBalance({
          amountCents: input.amountCents,
          accountBalanceCents: locked.balanceCents,
          accountArchived: locked.isArchived,
        });
      }
      await dbTx
        .update(accounts)
        .set({
          balanceCents: locked.balanceCents + delta,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, locked.id));
    }

    const [created] = await dbTx
      .insert(transactions)
      .values({
        householdId: session.householdId,
        costCenterId: input.costCenterId,
        categoryId: input.categoryId,
        accountId: resolvedAccountId,
        creditCardId,
        creditCardInvoiceId,
        paymentRail,
        paymentMethodId: await resolvePaymentMethodId(dbTx, session.householdId, {
          accountId: resolvedAccountId,
          creditCardId,
          paymentRail,
        }),
        type: input.type,
        status,
        amountCents: input.amountCents,
        occurredOn: input.occurredOn,
        dueOn,
        paidOn: isPaid ? input.occurredOn : null,
        description: input.description,
        notesEncrypted,
        tags: input.tags ?? [],
        source,
        duplicateHash: duplicateHash(input),
        createdBy: session.userId,
      })
      .returning();

    if (creditCardId && isPaid && input.type === 'expense') {
      await refreshCardInvoiceBalanceCache(dbTx, {
        householdId: session.householdId,
        creditCardId,
      });
    }

    return created;
  });

  await writeAudit(ctx, {
    action: 'create',
    resourceType: 'transaction',
    resourceId: row?.id,
    source,
    metadata: {
      amountCents: input.amountCents,
      type: input.type,
      status,
      creditCardId,
      paymentRail,
    },
  });

  return row;
}

export async function createPendingTransaction(
  ctx: AppContext,
  raw: CreatePendingTransactionInput,
  source = 'manual',
) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = createPendingTransactionSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const notesEncrypted = input.notes
    ? encryptSensitiveField(input.notes, ctx.encryptionSecret, session.householdId)
    : null;

  const installmentCount = input.installmentCount ?? 1;
  const totalCents = input.amountCents ?? null;
  const paymentRail = input.paymentRail ?? null;

  if (installmentCount === 1) {
    const amountCents = totalCents;
    const [row] = await ctx.db
      .insert(transactions)
      .values({
        householdId: session.householdId,
        costCenterId: input.costCenterId,
        categoryId: input.categoryId,
        accountId: input.accountId,
        paymentRail,
        type: input.type,
        status: 'pending',
        amountCents,
        occurredOn: input.dueOn,
        dueOn: input.dueOn,
        paidOn: null,
        description: input.description,
        notesEncrypted,
        tags: input.tags ?? [],
        source,
        duplicateHash: duplicateHash({
          occurredOn: input.dueOn,
          amountCents,
          description: input.description,
          accountId: input.accountId,
        }),
        createdBy: session.userId,
      })
      .returning();

    await writeAudit(ctx, {
      action: 'create_pending',
      resourceType: 'transaction',
      resourceId: row?.id,
      source,
      metadata: { amountCents, dueOn: input.dueOn, kind: 'variable' },
    });

    return row;
  }

  if (totalCents == null || totalCents <= 0) {
    throw new Error('Valor total obrigatório para parcelar');
  }

  const baseCents = Math.floor(totalCents / installmentCount);
  const remainderCents = totalCents - baseCents * installmentCount;
  const startYm = yearMonthFromIso(input.dueOn);
  const dueDay = Math.min(28, Math.max(1, Number(input.dueOn.slice(8, 10)) || 1));

  const created: Array<{ id: string }> = [];

  for (let number = 1; number <= installmentCount; number += 1) {
    const dueOn = dueOnForMonth(shiftYearMonth(startYm, number - 1), dueDay);
    const amountCents = number === installmentCount ? baseCents + remainderCents : baseCents;
    const description = `${input.description} (${number}/${installmentCount})`;

    const [row] = await ctx.db
      .insert(transactions)
      .values({
        householdId: session.householdId,
        costCenterId: input.costCenterId,
        categoryId: input.categoryId,
        accountId: input.accountId,
        paymentRail,
        type: input.type,
        status: 'pending',
        amountCents,
        occurredOn: dueOn,
        dueOn,
        paidOn: null,
        description,
        notesEncrypted: number === 1 ? notesEncrypted : null,
        tags: input.tags ?? [],
        source,
        duplicateHash: duplicateHash({
          occurredOn: dueOn,
          amountCents,
          description,
          accountId: input.accountId,
        }),
        createdBy: session.userId,
      })
      .returning();

    if (row) created.push(row);
  }

  await writeAudit(ctx, {
    action: 'create_pending',
    resourceType: 'transaction',
    resourceId: created[0]?.id,
    source,
    metadata: {
      amountCents: totalCents,
      dueOn: input.dueOn,
      kind: 'variable',
      installmentCount,
      createdCount: created.length,
    },
  });

  return created[0];
}

export async function createMonthlySeries(ctx: AppContext, raw: CreateMonthlySeriesInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = createMonthlySeriesSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [series] = await ctx.db
    .insert(transactionSeries)
    .values({
      householdId: session.householdId,
      costCenterId: input.costCenterId,
      categoryId: input.categoryId,
      accountId: input.accountId,
      type: input.type,
      description: input.description,
      interval: 'monthly',
      dueDay: input.dueDay,
      defaultAmountCents: input.defaultAmountCents ?? null,
      defaultPaymentRail: input.paymentRail ?? null,
      isActive: true,
    })
    .returning();

  if (!series) {
    throw new Error('Falha ao criar série');
  }

  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const materializeCount = input.materializeMonths ?? 2;
  for (let offset = 0; offset < materializeCount; offset += 1) {
    await ensureSeriesInstance(ctx, series.id, shiftYearMonth(currentMonth, offset));
  }

  await writeAudit(ctx, {
    action: 'create',
    resourceType: 'transaction_series',
    resourceId: series.id,
    metadata: {
      dueDay: input.dueDay,
      defaultAmountCents: input.defaultAmountCents ?? null,
      kind: 'fixed',
      materializeMonths: materializeCount,
    },
  });

  return series;
}

async function ensureSeriesInstance(ctx: AppContext, seriesId: string, yearMonth: string) {
  const session = requireSession(ctx.session);
  const [series] = await ctx.db
    .select()
    .from(transactionSeries)
    .where(
      and(
        eq(transactionSeries.id, seriesId),
        eq(transactionSeries.householdId, session.householdId),
        eq(transactionSeries.isActive, true),
      ),
    )
    .limit(1);

  if (!series) return null;

  const dueOn = dueOnForMonth(yearMonth, series.dueDay);
  const monthStart = `${yearMonth}-01`;
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const monthEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  const existing = await ctx.db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        eq(transactions.seriesId, series.id),
        isNull(transactions.deletedAt),
        gte(transactions.dueOn, monthStart),
        lte(transactions.dueOn, monthEnd),
      ),
    )
    .limit(1);

  if (existing[0]) return existing[0];

  const amountCents = series.defaultAmountCents ?? null;
  const [row] = await ctx.db
    .insert(transactions)
    .values({
      householdId: session.householdId,
      costCenterId: series.costCenterId,
      categoryId: series.categoryId,
      accountId: series.accountId,
      paymentRail: series.defaultPaymentRail,
      type: series.type,
      status: 'pending',
      amountCents,
      occurredOn: dueOn,
      dueOn,
      paidOn: null,
      description: series.description,
      tags: [],
      source: 'series',
      seriesId: series.id,
      duplicateHash: duplicateHash({
        occurredOn: dueOn,
        amountCents,
        description: series.description,
        accountId: series.accountId,
      }),
      createdBy: session.userId,
    })
    .returning();

  return row;
}

export async function ensureSeriesInstancesForMonth(ctx: AppContext, yearMonth?: string) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');

  const now = new Date();
  const current =
    yearMonth ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const next = shiftYearMonth(current, 1);

  const seriesList = await ctx.db
    .select()
    .from(transactionSeries)
    .where(
      and(
        eq(transactionSeries.householdId, session.householdId),
        eq(transactionSeries.isActive, true),
      ),
    );

  for (const series of seriesList) {
    await ensureSeriesInstance(ctx, series.id, current);
    await ensureSeriesInstance(ctx, series.id, next);
  }
}

export async function updatePendingAmount(ctx: AppContext, raw: UpdatePendingAmountInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = updatePendingAmountSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [tx] = await ctx.db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, input.transactionId),
        eq(transactions.householdId, session.householdId),
        isNull(transactions.deletedAt),
      ),
    )
    .limit(1);

  if (!tx || tx.status !== 'pending') {
    throw new Error('Lançamento pendente inválido');
  }

  const [row] = await ctx.db
    .update(transactions)
    .set({
      amountCents: input.amountCents,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, tx.id))
    .returning();

  if (tx.installmentId && input.amountCents != null) {
    await ctx.db
      .update(installments)
      .set({ amountCents: input.amountCents })
      .where(eq(installments.id, tx.installmentId));
  }

  await writeAudit(ctx, {
    action: 'update_amount',
    resourceType: 'transaction',
    resourceId: tx.id,
    metadata: { amountCents: input.amountCents },
  });

  return row;
}

export async function updateTransaction(ctx: AppContext, raw: UpdateTransactionInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = updateTransactionSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [tx] = await ctx.db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, input.transactionId),
        eq(transactions.householdId, session.householdId),
        isNull(transactions.deletedAt),
      ),
    )
    .limit(1);

  if (!tx) {
    throw new Error('Lançamento não encontrado');
  }

  const [category] = await ctx.db
    .select({ id: categories.id, type: categories.type })
    .from(categories)
    .where(
      and(eq(categories.id, input.categoryId), eq(categories.householdId, session.householdId)),
    )
    .limit(1);

  if (!category) {
    throw new Error('Categoria inválida');
  }
  if (category.type !== input.type) {
    throw new Error('Categoria não combina com o tipo do lançamento');
  }

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

  const [account] = await ctx.db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, input.accountId), eq(accounts.householdId, session.householdId)))
    .limit(1);
  if (!account) {
    throw new Error('Conta inválida');
  }

  const creditCardId = input.creditCardId === undefined ? tx.creditCardId : input.creditCardId;
  const paymentRail =
    creditCardId != null
      ? null
      : input.paymentRail === undefined
        ? tx.paymentRail
        : input.paymentRail;
  const paymentMethodId = await resolvePaymentMethodId(ctx.db, session.householdId, {
    paymentMethodId: input.paymentMethodId,
    accountId: input.accountId,
    creditCardId,
    paymentRail,
  });

  const leavingCredit = Boolean(tx.creditCardId) && creditCardId == null;
  /** Crédito = compra na fatura (sempre paga no cartão). Conta após sair do crédito = pendente. */
  const status = creditCardId ? 'paid' : leavingCredit ? 'pending' : input.status;
  const isPaid = status === 'paid';
  const amountCents = input.amountCents ?? null;
  const dueOn = isPaid ? (tx.dueOn ?? input.date) : input.date;
  const paidOn = isPaid ? input.date : null;
  const occurredOn = input.date;

  let resolvedAccountId = input.accountId;
  let creditCardInvoiceId: string | null = null;

  if (creditCardId) {
    assertCardPurchase({
      type: input.type,
      amountCents: amountCents ?? 0,
    });
    if (!isPaid || input.type !== 'expense') {
      throw new Error(
        'Compra no cartão deve ser registrada como despesa já paga — entra na fatura do ciclo.',
      );
    }
  }

  const cardsToRefresh = new Set<string>();
  if (tx.creditCardId) cardsToRefresh.add(tx.creditCardId);
  if (creditCardId) cardsToRefresh.add(creditCardId);

  const row = await ctx.db.transaction(async (dbTx) => {
    if (creditCardId) {
      const [card] = await dbTx
        .select()
        .from(creditCards)
        .where(
          and(eq(creditCards.id, creditCardId), eq(creditCards.householdId, session.householdId)),
        )
        .limit(1)
        .for('update');
      if (!card) {
        throw new Error('Cartão inválido');
      }
      assertCardPurchase({
        type: input.type,
        amountCents: amountCents ?? 1,
        cardArchived: card.isArchived,
      });
      if (!cardHasCredit(card.cardMode)) {
        throw new Error('Cartão não possui crédito');
      }
      resolvedAccountId = card.paymentAccountId;
      const invoice = await getOrCreateInvoiceForPurchase(dbTx, {
        householdId: session.householdId,
        card,
        purchaseOn: occurredOn,
      });
      creditCardInvoiceId = invoice.id;
    }

    const [updated] = await dbTx
      .update(transactions)
      .set({
        costCenterId: input.costCenterId,
        categoryId: input.categoryId,
        accountId: resolvedAccountId,
        creditCardId,
        creditCardInvoiceId,
        paymentRail,
        paymentMethodId,
        type: input.type,
        status,
        amountCents,
        occurredOn,
        dueOn,
        paidOn,
        description: input.description || null,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id))
      .returning();

    if (tx.installmentId) {
      await dbTx
        .update(installments)
        .set({
          status: isPaid ? 'paid' : 'pending',
          paidOn,
          ...(amountCents != null ? { amountCents } : {}),
          transactionId: isPaid ? tx.id : null,
        })
        .where(
          and(
            eq(installments.id, tx.installmentId),
            eq(installments.householdId, session.householdId),
          ),
        );
    }

    for (const cardId of cardsToRefresh) {
      await refreshCardInvoiceBalanceCache(dbTx, {
        householdId: session.householdId,
        creditCardId: cardId,
      });
    }

    return updated;
  });

  await writeAudit(ctx, {
    action: 'update',
    resourceType: 'transaction',
    resourceId: tx.id,
    metadata: {
      type: input.type,
      status,
      amountCents,
      date: input.date,
      creditCardId,
      creditCardInvoiceId,
      paymentRail,
    },
  });

  return row;
}

export async function softDeleteTransaction(ctx: AppContext, raw: SoftDeleteTransactionInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = softDeleteTransactionSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [tx] = await ctx.db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, input.transactionId),
        eq(transactions.householdId, session.householdId),
        isNull(transactions.deletedAt),
      ),
    )
    .limit(1);

  if (!tx) {
    throw new Error('Lançamento não encontrado');
  }

  await ctx.db.transaction(async (dbTx) => {
    await dbTx
      .update(transactions)
      .set({
        deletedAt: new Date(),
        installmentId: null,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    if (tx.installmentId) {
      await dbTx
        .update(installments)
        .set({
          status: 'pending',
          paidOn: null,
          transactionId: null,
        })
        .where(
          and(
            eq(installments.id, tx.installmentId),
            eq(installments.householdId, session.householdId),
          ),
        );
    }

    if (
      tx.creditCardId &&
      tx.status === 'paid' &&
      tx.type === 'expense' &&
      tx.amountCents != null &&
      tx.amountCents > 0
    ) {
      const [card] = await dbTx
        .select()
        .from(creditCards)
        .where(
          and(
            eq(creditCards.id, tx.creditCardId),
            eq(creditCards.householdId, session.householdId),
          ),
        )
        .limit(1)
        .for('update');
      if (card) {
        await dbTx
          .update(creditCards)
          .set({
            invoiceBalanceCents: Math.max(0, card.invoiceBalanceCents - tx.amountCents),
            updatedAt: new Date(),
          })
          .where(eq(creditCards.id, card.id));
      }
    }
  });

  await writeAudit(ctx, {
    action: 'delete',
    resourceType: 'transaction',
    resourceId: tx.id,
    metadata: { installmentId: tx.installmentId, creditCardId: tx.creditCardId },
  });
}

export async function payTransaction(ctx: AppContext, raw: PayTransactionInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = payTransactionSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [tx] = await ctx.db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, input.transactionId),
        eq(transactions.householdId, session.householdId),
        isNull(transactions.deletedAt),
      ),
    )
    .limit(1);

  if (!tx || tx.status !== 'pending') {
    throw new Error('Lançamento pendente inválido');
  }

  const amountCents = input.amountCents ?? tx.amountCents;
  if (amountCents == null || amountCents <= 0) {
    throw new Error('Informe o valor para pagar');
  }

  if (input.creditCardId && tx.type !== 'expense') {
    throw new Error('Somente despesas podem ser pagas no cartão');
  }

  const payWithCardId = input.creditCardId ?? null;

  const row = await ctx.db.transaction(async (dbTx) => {
    if (payWithCardId) {
      const [card] = await dbTx
        .select()
        .from(creditCards)
        .where(
          and(eq(creditCards.id, payWithCardId), eq(creditCards.householdId, session.householdId)),
        )
        .limit(1)
        .for('update');
      if (!card) {
        throw new Error('Cartão não encontrado');
      }
      assertCardPurchase({
        type: 'expense',
        amountCents,
        cardArchived: card.isArchived,
      });
      if (!cardHasCredit(card.cardMode)) {
        throw new Error('Cartão não possui crédito');
      }

      const invoice = await getOrCreateInvoiceForPurchase(dbTx, {
        householdId: session.householdId,
        card,
        purchaseOn: input.paidOn,
      });

      const [paid] = await dbTx
        .update(transactions)
        .set({
          status: 'paid',
          amountCents,
          paidOn: input.paidOn,
          occurredOn: input.paidOn,
          accountId: card.paymentAccountId,
          creditCardId: card.id,
          creditCardInvoiceId: invoice.id,
          paymentRail: null,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, tx.id))
        .returning();

      if (tx.installmentId) {
        await dbTx
          .update(installments)
          .set({
            status: 'paid',
            paidOn: input.paidOn,
            amountCents,
            transactionId: tx.id,
          })
          .where(eq(installments.id, tx.installmentId));
      }

      await refreshCardInvoiceBalanceCache(dbTx, {
        householdId: session.householdId,
        creditCardId: card.id,
      });

      return paid;
    }

    const accountId = input.accountId ?? tx.accountId;
    const [account] = await dbTx
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.householdId, session.householdId)))
      .limit(1);

    if (!account) {
      throw new Error('Conta não encontrada');
    }

    if (input.applyToBalance === true && account.isArchived) {
      throw new Error('Conta está arquivada');
    }

    const paymentRail = input.paymentRail ?? 'pix';
    if (
      !accountAllowsPaymentRail(coerceAllowedPaymentRails(account.allowedPaymentRails), paymentRail)
    ) {
      throw new Error('Forma de pagamento não permitida nesta conta');
    }

    // Conta + PIX/débito/TED (e receber): move saldo por padrão. Crédito não.
    const applyToBalance = paymentMethodMovesAccountBalance({
      type: 'account',
      paymentRail,
    })
      ? (input.applyToBalance ?? true)
      : false;

    if (applyToBalance) {
      const [locked] = await dbTx
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.householdId, session.householdId)))
        .limit(1)
        .for('update');

      if (!locked) {
        throw new Error('Conta não encontrada');
      }
      if (locked.isArchived) {
        throw new Error('Conta está arquivada');
      }

      const delta = tx.type === 'expense' ? -amountCents : amountCents;
      if (delta < 0) {
        assertAccountDebitBalance({
          amountCents,
          accountBalanceCents: locked.balanceCents,
          accountArchived: locked.isArchived,
        });
      }

      await dbTx
        .update(accounts)
        .set({
          balanceCents: locked.balanceCents + delta,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, locked.id));
    }

    let creditCardInvoiceId = tx.creditCardInvoiceId;
    if (tx.creditCardId && tx.type === 'expense' && amountCents > 0) {
      const [card] = await dbTx
        .select()
        .from(creditCards)
        .where(
          and(
            eq(creditCards.id, tx.creditCardId),
            eq(creditCards.householdId, session.householdId),
          ),
        )
        .limit(1)
        .for('update');
      if (!card) {
        throw new Error('Cartão não encontrado');
      }
      if (card.isArchived) {
        throw new Error('Cartão está arquivado');
      }
      const invoice = await getOrCreateInvoiceForPurchase(dbTx, {
        householdId: session.householdId,
        card,
        purchaseOn: input.paidOn,
      });
      creditCardInvoiceId = invoice.id;
    }

    const [paid] = await dbTx
      .update(transactions)
      .set({
        status: 'paid',
        amountCents,
        paidOn: input.paidOn,
        occurredOn: input.paidOn,
        accountId,
        creditCardInvoiceId,
        paymentRail: input.paymentRail === undefined ? tx.paymentRail : input.paymentRail,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id))
      .returning();

    if (tx.creditCardId && tx.type === 'expense') {
      await refreshCardInvoiceBalanceCache(dbTx, {
        householdId: session.householdId,
        creditCardId: tx.creditCardId,
      });
    }

    if (tx.installmentId) {
      await dbTx
        .update(installments)
        .set({
          status: 'paid',
          paidOn: input.paidOn,
          amountCents,
          transactionId: tx.id,
        })
        .where(eq(installments.id, tx.installmentId));
    }

    return paid;
  });

  await writeAudit(ctx, {
    action: 'pay',
    resourceType: 'transaction',
    resourceId: tx.id,
    metadata: {
      amountCents,
      paidOn: input.paidOn,
      installmentId: tx.installmentId,
      accountId: row?.accountId,
      creditCardId: payWithCardId ?? tx.creditCardId,
      paymentMethod: payWithCardId ? 'credit_card' : 'account',
    },
  });

  return row;
}

export async function payTransactionsBulk(ctx: AppContext, raw: PayTransactionsBulkInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = payTransactionsBulkSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const results = [];
  for (const item of input.items) {
    const row = await payTransaction(ctx, {
      householdId: session.householdId,
      transactionId: item.transactionId,
      paidOn: item.paidOn,
      amountCents: item.amountCents,
      accountId: item.accountId,
      creditCardId: item.creditCardId,
      paymentRail: item.paymentRail,
      applyToBalance: item.applyToBalance,
    });
    results.push(row);
  }

  await writeAudit(ctx, {
    action: 'pay_bulk',
    resourceType: 'transaction',
    metadata: {
      count: input.items.length,
      transactionIds: input.items.map((item) => item.transactionId),
    },
  });

  return results;
}

export async function confirmIncomeItem(
  ctx: AppContext,
  input: {
    transactionId: string;
    paidOn: string;
    amountCents: number;
    accountId?: string;
    applyToBalance?: boolean;
  },
): Promise<{ redirectTo?: string }> {
  const session = requireSession(ctx.session);
  await payTransaction(ctx, {
    householdId: session.householdId,
    transactionId: input.transactionId,
    paidOn: input.paidOn,
    amountCents: input.amountCents,
    accountId: input.accountId,
    applyToBalance: input.applyToBalance,
  });

  const paidOn = input.paidOn;
  const yearMonth = paidOn.slice(0, 7);
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  const remaining = await ctx.db
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
    await ctx.db
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
    return { redirectTo: '/payments?flow=receive&payday=1' };
  }

  return {};
}

export async function createFinancing(ctx: AppContext, raw: CreateFinancingInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'financings.write');
  const input = createFinancingSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const amortization = buildAmortizationSchedule({
    system: input.amortizationSystem,
    principalCents: input.principalCents,
    installmentCount: input.installmentCount,
    firstDueOn: input.firstDueOn,
    annualRateBps: input.annualRateBps,
    installmentAmountCents: input.installmentAmountCents,
  });

  const [financing] = await ctx.db
    .insert(financings)
    .values({
      householdId: session.householdId,
      costCenterId: input.costCenterId,
      accountId: input.accountId,
      name: input.name,
      institution: input.institution,
      principalCents: input.principalCents,
      installmentCount: input.installmentCount,
      installmentAmountCents: amortization.firstInstallmentCents,
      annualRateBps: input.annualRateBps ?? amortization.annualRateBps,
      amortizationSystem: input.amortizationSystem,
      category: input.category,
      firstDueOn: input.firstDueOn,
    })
    .returning();

  if (!financing) {
    throw new Error('Failed to create financing');
  }

  const createdInstallments = await ctx.db
    .insert(installments)
    .values(
      amortization.schedule.map((item) => ({
        householdId: session.householdId,
        financingId: financing.id,
        number: item.number,
        dueOn: item.dueOn,
        amountCents: item.amountCents,
        interestCents: item.interestCents,
        principalCents: item.principalCents,
        balanceAfterCents: item.balanceAfterCents,
        status: 'pending' as const,
      })),
    )
    .returning();

  const cats = await ctx.db
    .select()
    .from(categories)
    .where(and(eq(categories.householdId, session.householdId), eq(categories.type, 'expense')));
  const categoryId = cats.find((c) => c.name.toLowerCase().includes('financ'))?.id ?? cats[0]?.id;

  if (categoryId) {
    for (const installment of createdInstallments) {
      const [tx] = await ctx.db
        .insert(transactions)
        .values({
          householdId: session.householdId,
          costCenterId: financing.costCenterId,
          categoryId,
          accountId: financing.accountId,
          type: 'expense',
          status: 'pending',
          amountCents: installment.amountCents,
          occurredOn: installment.dueOn,
          dueOn: installment.dueOn,
          paidOn: null,
          description: `Parcela ${installment.number} — ${financing.name}`,
          tags: [],
          source: 'financing',
          installmentId: installment.id,
          duplicateHash: duplicateHash({
            occurredOn: installment.dueOn,
            amountCents: installment.amountCents,
            description: `Parcela ${installment.number} — ${financing.name}`,
            accountId: financing.accountId,
          }),
          createdBy: session.userId,
        })
        .returning();

      if (tx) {
        await ctx.db
          .update(installments)
          .set({ transactionId: tx.id })
          .where(eq(installments.id, installment.id));
      }
    }
  }

  await writeAudit(ctx, {
    action: 'create',
    resourceType: 'financing',
    resourceId: financing.id,
  });

  return financing;
}

export async function payInstallmentWithCategory(
  ctx: AppContext,
  raw: PayInstallmentInput & { categoryId?: string },
) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'financings.write');
  const input = payInstallmentSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [installment] = await ctx.db
    .select()
    .from(installments)
    .where(
      and(
        eq(installments.id, input.installmentId),
        eq(installments.householdId, session.householdId),
      ),
    )
    .limit(1);

  if (!installment || installment.status === 'paid') {
    throw new Error('Parcela inválida');
  }

  const [financing] = await ctx.db
    .select()
    .from(financings)
    .where(
      and(
        eq(financings.id, installment.financingId),
        eq(financings.householdId, session.householdId),
      ),
    )
    .limit(1);

  if (!financing) {
    throw new Error('Financiamento não encontrado');
  }

  const categoryId =
    raw.categoryId ??
    input.categoryId ??
    (
      await ctx.db
        .select()
        .from(categories)
        .where(and(eq(categories.householdId, session.householdId), eq(categories.type, 'expense')))
        .limit(1)
    )[0]?.id;

  if (!categoryId) {
    throw new Error('Categoria obrigatória');
  }

  let transactionId = installment.transactionId;

  if (!transactionId) {
    const pending = await createPendingTransaction(
      ctx,
      {
        householdId: session.householdId,
        costCenterId: financing.costCenterId,
        categoryId,
        accountId: financing.accountId,
        type: 'expense',
        amountCents: installment.amountCents,
        dueOn: installment.dueOn,
        description: `Parcela ${installment.number} — ${financing.name}`,
        installmentCount: 1,
      },
      'financing',
    );

    if (!pending) {
      throw new Error('Falha ao criar lançamento da parcela');
    }

    await ctx.db
      .update(transactions)
      .set({ installmentId: installment.id })
      .where(eq(transactions.id, pending.id));

    transactionId = pending.id;
  }

  const paid = await payTransaction(ctx, {
    householdId: session.householdId,
    transactionId,
    paidOn: input.paidOn,
    amountCents: input.amountCents,
  });

  const extraAmortizationCents = input.extraAmortizationCents ?? 0;
  if (extraAmortizationCents <= 0) {
    return paid;
  }

  const newBalance = Math.max(0, installment.balanceAfterCents - extraAmortizationCents);

  // Lançamento da amortização no mês em que amortizou (pago em).
  await createTransaction(
    ctx,
    {
      householdId: session.householdId,
      costCenterId: financing.costCenterId,
      categoryId,
      accountId: financing.accountId,
      type: 'expense',
      status: 'paid',
      amountCents: extraAmortizationCents,
      occurredOn: input.paidOn,
      dueOn: input.paidOn,
      description: `Amortização — ${financing.name}`,
    },
    'financing_amortization',
  );

  const futurePending = await ctx.db
    .select()
    .from(installments)
    .where(
      and(
        eq(installments.financingId, financing.id),
        eq(installments.householdId, session.householdId),
        eq(installments.status, 'pending'),
      ),
    )
    .orderBy(asc(installments.number));

  for (const future of futurePending) {
    if (future.transactionId) {
      await ctx.db
        .update(transactions)
        .set({
          deletedAt: new Date(),
          installmentId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transactions.id, future.transactionId),
            eq(transactions.householdId, session.householdId),
            eq(transactions.status, 'pending'),
          ),
        );
    }
    await ctx.db.delete(installments).where(eq(installments.id, future.id));
  }

  if (newBalance === 0) {
    await writeAudit(ctx, {
      action: 'extra_amortization',
      resourceType: 'financing',
      resourceId: financing.id,
      metadata: {
        installmentId: installment.id,
        extraAmortizationCents,
        newBalance: 0,
        paidOn: input.paidOn,
      },
    });
    return paid;
  }

  const system = financing.amortizationSystem as AmortizationSystem;
  const nextDueOn = addMonths(installment.dueOn, 1);
  const rebuilt = rebuildRemainingSchedule({
    system,
    balanceCents: newBalance,
    firstDueOn: nextDueOn,
    annualRateBps: financing.annualRateBps ?? undefined,
    installmentAmountCents: financing.installmentAmountCents,
    amortizationCents: installment.principalCents,
  });

  const createdInstallments = await ctx.db
    .insert(installments)
    .values(
      rebuilt.schedule.map((item, index) => ({
        householdId: session.householdId,
        financingId: financing.id,
        number: installment.number + index + 1,
        dueOn: item.dueOn,
        amountCents: item.amountCents,
        interestCents: item.interestCents,
        principalCents: item.principalCents,
        balanceAfterCents: item.balanceAfterCents,
        status: 'pending' as const,
      })),
    )
    .returning();

  for (const row of createdInstallments) {
    const [tx] = await ctx.db
      .insert(transactions)
      .values({
        householdId: session.householdId,
        costCenterId: financing.costCenterId,
        categoryId,
        accountId: financing.accountId,
        type: 'expense',
        status: 'pending',
        amountCents: row.amountCents,
        occurredOn: row.dueOn,
        dueOn: row.dueOn,
        paidOn: null,
        description: `Parcela ${row.number} — ${financing.name}`,
        tags: [],
        source: 'financing',
        installmentId: row.id,
        duplicateHash: duplicateHash({
          occurredOn: row.dueOn,
          amountCents: row.amountCents,
          description: `Parcela ${row.number} — ${financing.name}`,
          accountId: financing.accountId,
        }),
        createdBy: session.userId,
      })
      .returning();

    if (tx) {
      await ctx.db
        .update(installments)
        .set({ transactionId: tx.id })
        .where(eq(installments.id, row.id));
    }
  }

  await ctx.db
    .update(financings)
    .set({
      installmentCount: installment.number + createdInstallments.length,
    })
    .where(eq(financings.id, financing.id));

  await writeAudit(ctx, {
    action: 'extra_amortization',
    resourceType: 'financing',
    resourceId: financing.id,
    metadata: {
      installmentId: installment.id,
      extraAmortizationCents,
      newBalance,
      rebuiltCount: createdInstallments.length,
      paidOn: input.paidOn,
    },
  });

  return paid;
}

export async function createCreditCard(ctx: AppContext, raw: CreateCreditCardInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = createCreditCardSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [institution] = await ctx.db
    .select({ id: institutions.id })
    .from(institutions)
    .where(
      and(
        eq(institutions.id, input.institutionId),
        eq(institutions.householdId, session.householdId),
      ),
    )
    .limit(1);
  if (!institution) {
    throw new Error('Banco inválido');
  }

  const [paymentAccount] = await ctx.db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.id, input.paymentAccountId), eq(accounts.householdId, session.householdId)),
    )
    .limit(1);
  if (!paymentAccount) {
    throw new Error('Conta de pagamento inválida');
  }

  const [row] = await ctx.db
    .insert(creditCards)
    .values({
      householdId: session.householdId,
      institutionId: input.institutionId,
      paymentAccountId: input.paymentAccountId,
      name: input.name,
      cardMode: input.cardMode,
      lastFour: input.lastFour ?? null,
      creditLimitCents: input.cardMode === 'debit' ? 0 : input.creditLimitCents,
      invoiceBalanceCents: input.cardMode === 'debit' ? 0 : input.invoiceBalanceCents,
      closingDay: input.cardMode === 'debit' ? 1 : input.closingDay,
      dueDay: input.cardMode === 'debit' ? 1 : input.dueDay,
    })
    .returning();

  if (row) {
    await ensureCreditCardPaymentMethod(ctx.db, {
      householdId: session.householdId,
      creditCardId: row.id,
      paymentAccountId: input.paymentAccountId,
      cardMode: input.cardMode,
    });
    if (input.cardMode !== 'debit' && input.invoiceBalanceCents > 0) {
      const today = new Date().toISOString().slice(0, 10);
      await syncCardInvoiceOpeningBalance(ctx.db, {
        householdId: session.householdId,
        userId: session.userId,
        card: row,
        targetBalanceCents: input.invoiceBalanceCents,
        purchaseOn: today,
      });
    }
  }

  await writeAudit(ctx, {
    action: 'create',
    resourceType: 'credit_card',
    resourceId: row?.id,
    metadata: { name: input.name, institutionId: input.institutionId },
  });

  return row;
}

export async function updateCreditCard(ctx: AppContext, raw: UpdateCreditCardInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write');
  const input = updateCreditCardSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [existing] = await ctx.db
    .select()
    .from(creditCards)
    .where(
      and(eq(creditCards.id, input.creditCardId), eq(creditCards.householdId, session.householdId)),
    )
    .limit(1);
  if (!existing) {
    throw new Error('Cartão não encontrado');
  }

  const [institution] = await ctx.db
    .select({ id: institutions.id })
    .from(institutions)
    .where(
      and(
        eq(institutions.id, input.institutionId),
        eq(institutions.householdId, session.householdId),
      ),
    )
    .limit(1);
  if (!institution) {
    throw new Error('Banco inválido');
  }

  const [paymentAccount] = await ctx.db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(eq(accounts.id, input.paymentAccountId), eq(accounts.householdId, session.householdId)),
    )
    .limit(1);
  if (!paymentAccount) {
    throw new Error('Conta de pagamento inválida');
  }

  const [row] = await ctx.db
    .update(creditCards)
    .set({
      institutionId: input.institutionId,
      paymentAccountId: input.paymentAccountId,
      name: input.name,
      cardMode: input.cardMode,
      lastFour: input.lastFour ?? null,
      creditLimitCents: input.cardMode === 'debit' ? 0 : input.creditLimitCents,
      invoiceBalanceCents: input.cardMode === 'debit' ? 0 : input.invoiceBalanceCents,
      closingDay: input.cardMode === 'debit' ? 1 : input.closingDay,
      dueDay: input.cardMode === 'debit' ? 1 : input.dueDay,
      updatedAt: new Date(),
    })
    .where(eq(creditCards.id, existing.id))
    .returning();

  if (row) {
    await ensureCreditCardPaymentMethod(ctx.db, {
      householdId: session.householdId,
      creditCardId: row.id,
      paymentAccountId: row.paymentAccountId,
      cardMode: row.cardMode,
    });
    const today = new Date().toISOString().slice(0, 10);
    await syncCardInvoiceOpeningBalance(ctx.db, {
      householdId: session.householdId,
      userId: session.userId,
      card: row,
      targetBalanceCents: input.cardMode === 'debit' ? 0 : input.invoiceBalanceCents,
      purchaseOn: today,
    });
  }

  await writeAudit(ctx, {
    action: 'update',
    resourceType: 'credit_card',
    resourceId: existing.id,
    metadata: { name: input.name },
  });

  return row;
}

export async function payCreditCardInvoice(ctx: AppContext, raw: PayCreditCardInvoiceInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = payCreditCardInvoiceSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const result = await ctx.db.transaction(async (dbTx) => {
    const [card] = await dbTx
      .select()
      .from(creditCards)
      .where(
        and(
          eq(creditCards.id, input.creditCardId),
          eq(creditCards.householdId, session.householdId),
        ),
      )
      .limit(1)
      .for('update');
    if (!card) {
      throw new Error('Cartão não encontrado');
    }

    const paymentAccountId = input.paymentAccountId ?? card.paymentAccountId;
    const [account] = await dbTx
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, paymentAccountId), eq(accounts.householdId, session.householdId)))
      .limit(1)
      .for('update');
    if (!account) {
      throw new Error('Conta de pagamento não encontrada');
    }

    const invoicePaymentRail = input.paymentRail ?? 'pix';
    if (
      !accountAllowsPaymentRail(
        coerceAllowedPaymentRails(account.allowedPaymentRails),
        invoicePaymentRail,
      )
    ) {
      throw new Error('Forma de pagamento não permitida nesta conta');
    }

    const [invoice] = await dbTx
      .select()
      .from(creditCardInvoices)
      .where(
        and(
          eq(creditCardInvoices.creditCardId, card.id),
          eq(creditCardInvoices.householdId, session.householdId),
          inArray(creditCardInvoices.status, ['open', 'closed']),
        ),
      )
      .orderBy(asc(creditCardInvoices.dueOn))
      .limit(1);

    const purchases = invoice
      ? await sumInvoiceBalanceCents(dbTx, {
          householdId: session.householdId,
          invoiceId: invoice.id,
        })
      : card.invoiceBalanceCents;
    const invoiceBalance = invoice
      ? Math.max(0, purchases - invoice.amountPaidCents)
      : card.invoiceBalanceCents;

    assertPayInvoice({
      amountCents: input.amountCents,
      accountBalanceCents: account.balanceCents,
      invoiceBalanceCents: invoiceBalance,
      accountArchived: account.isArchived,
      cardArchived: card.isArchived,
    });

    const [expenseCat] = await dbTx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.householdId, session.householdId), eq(categories.type, 'expense')))
      .limit(1);
    if (!expenseCat) {
      throw new Error('Cadastre uma categoria de despesa para registrar o pagamento da fatura');
    }

    await dbTx
      .update(accounts)
      .set({
        balanceCents: account.balanceCents - input.amountCents,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));

    const [settlement] = await dbTx
      .insert(transactions)
      .values({
        householdId: session.householdId,
        costCenterId: account.costCenterId,
        categoryId: expenseCat.id,
        accountId: account.id,
        creditCardId: null,
        creditCardInvoiceId: null,
        paymentRail: invoicePaymentRail,
        type: 'expense',
        status: 'paid',
        amountCents: input.amountCents,
        occurredOn: input.paidOn,
        dueOn: invoice?.dueOn ?? input.paidOn,
        paidOn: input.paidOn,
        description: `Pagamento fatura ${card.name}`,
        tags: [],
        source: 'manual',
        createdBy: session.userId,
      })
      .returning();

    if (invoice) {
      const nextPaid = invoice.amountPaidCents + input.amountCents;
      const remaining = invoiceBalance - input.amountCents;
      await dbTx
        .update(creditCardInvoices)
        .set({
          amountPaidCents: nextPaid,
          status: remaining <= 0 ? 'paid' : invoice.status,
          updatedAt: new Date(),
        })
        .where(eq(creditCardInvoices.id, invoice.id));
    }

    await refreshCardInvoiceBalanceCache(dbTx, {
      householdId: session.householdId,
      creditCardId: card.id,
    });

    return {
      cardId: card.id,
      paymentAccountId,
      amountCents: input.amountCents,
      settlementId: settlement?.id,
      invoiceId: invoice?.id ?? null,
    };
  });

  await writeAudit(ctx, {
    action: 'pay_invoice',
    resourceType: 'credit_card',
    resourceId: result.cardId,
    metadata: {
      amountCents: result.amountCents,
      paidOn: input.paidOn,
      paymentAccountId: result.paymentAccountId,
      settlementId: result.settlementId,
      invoiceId: result.invoiceId,
    },
  });

  return result;
}

export async function createTransfer(ctx: AppContext, raw: CreateTransferInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write');
  const input = createTransferSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  if (input.householdId !== session.householdId) {
    throw new Error('household mismatch');
  }

  const transfer = await ctx.db.transaction(async (tx) => {
    const [fromAccount] = await tx
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.id, input.fromAccountId), eq(accounts.householdId, session.householdId)),
      )
      .limit(1)
      .for('update');

    const [toAccount] = await tx
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, input.toAccountId), eq(accounts.householdId, session.householdId)))
      .limit(1)
      .for('update');

    if (!fromAccount || !toAccount) {
      throw new Error('Conta não encontrada');
    }

    assertTransferAllowed({
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amountCents: input.amountCents,
      fromBalanceCents: fromAccount.balanceCents,
      fromArchived: fromAccount.isArchived,
      toArchived: toAccount.isArchived,
    });

    await tx
      .update(accounts)
      .set({
        balanceCents: fromAccount.balanceCents - input.amountCents,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, fromAccount.id));

    await tx
      .update(accounts)
      .set({
        balanceCents: toAccount.balanceCents + input.amountCents,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, toAccount.id));

    const [row] = await tx
      .insert(accountTransfers)
      .values({
        householdId: session.householdId,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amountCents: input.amountCents,
        occurredOn: input.occurredOn,
        description: input.description,
        createdBy: session.userId,
      })
      .returning();

    if (!row) {
      throw new Error('Falha ao registrar transferência');
    }

    return row;
  });

  await writeAudit(ctx, {
    action: 'create',
    resourceType: 'account_transfer',
    resourceId: transfer.id,
    metadata: {
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountCents: input.amountCents,
      occurredOn: input.occurredOn,
    },
  });

  return transfer;
}

export async function payInstallmentsBulk(
  ctx: AppContext,
  raw: PayInstallmentsBulkInput & { categoryId?: string },
) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'financings.write');
  const input = payInstallmentsBulkSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const ids = input.items.map((item) => item.installmentId);
  const rows = await ctx.db
    .select({ id: installments.id, number: installments.number })
    .from(installments)
    .where(and(inArray(installments.id, ids), eq(installments.householdId, session.householdId)));

  const numberById = new Map(rows.map((row) => [row.id, row.number]));
  const sorted = [...input.items].sort(
    (a, b) => (numberById.get(a.installmentId) ?? 0) - (numberById.get(b.installmentId) ?? 0),
  );

  const results = [];
  for (const item of sorted) {
    const paid = await payInstallmentWithCategory(ctx, {
      householdId: session.householdId,
      installmentId: item.installmentId,
      paidOn: item.paidOn,
      amountCents: item.amountCents,
      categoryId: raw.categoryId ?? input.categoryId,
    });
    results.push(paid);
  }
  return results;
}

/**
 * Recalcula o cronograma do financiamento.
 * Mantém parcelas já pagas; apaga pendentes e regenera a partir do saldo remanescente
 * (ou do zero, se ainda não houver pagamento).
 */
export async function rebuildFinancing(ctx: AppContext, raw: RebuildFinancingInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'financings.write');
  const input = rebuildFinancingSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [financing] = await ctx.db
    .select()
    .from(financings)
    .where(
      and(
        eq(financings.id, input.financingId),
        eq(financings.householdId, session.householdId),
        isNull(financings.deletedAt),
      ),
    )
    .limit(1);

  if (!financing) throw new Error('Financiamento não encontrado');

  const existing = await ctx.db
    .select()
    .from(installments)
    .where(
      and(
        eq(installments.financingId, financing.id),
        eq(installments.householdId, session.householdId),
      ),
    )
    .orderBy(asc(installments.number));

  const paid = existing.filter((row) => row.status === 'paid');
  const pending = existing.filter((row) => row.status !== 'paid');

  for (const row of pending) {
    if (row.transactionId) {
      await ctx.db
        .update(transactions)
        .set({ deletedAt: new Date(), installmentId: null })
        .where(
          and(
            eq(transactions.id, row.transactionId),
            eq(transactions.householdId, session.householdId),
          ),
        );
    }
  }

  if (pending.length > 0) {
    await ctx.db
      .delete(installments)
      .where(
        and(
          eq(installments.financingId, financing.id),
          eq(installments.householdId, session.householdId),
          ne(installments.status, 'paid'),
        ),
      );
  }

  let schedule;
  let startNumber = 1;

  if (paid.length === 0) {
    schedule = buildAmortizationSchedule({
      system: input.amortizationSystem,
      principalCents: input.principalCents,
      installmentCount: input.installmentCount,
      firstDueOn: input.firstDueOn,
      annualRateBps: input.annualRateBps,
      installmentAmountCents: input.installmentAmountCents,
    });
  } else {
    const lastPaid = paid[paid.length - 1]!;
    startNumber = lastPaid.number + 1;
    const remainingSlots = Math.max(1, input.installmentCount - paid.length);
    const rateBps = input.annualRateBps ?? financing.annualRateBps ?? undefined;
    const pmt =
      input.installmentAmountCents ?? financing.installmentAmountCents ?? lastPaid.amountCents;
    schedule = rebuildRemainingSchedule({
      system: input.amortizationSystem,
      balanceCents: lastPaid.balanceAfterCents,
      firstDueOn: addMonths(lastPaid.dueOn, 1),
      annualRateBps: rateBps ?? undefined,
      installmentAmountCents: pmt,
      amortizationCents: lastPaid.principalCents,
      maxInstallments: remainingSlots,
    });
  }

  const annualRateBps = input.annualRateBps ?? schedule.annualRateBps ?? financing.annualRateBps;

  await ctx.db
    .update(financings)
    .set({
      name: input.name,
      institution: input.institution,
      principalCents: input.principalCents,
      installmentCount: paid.length + schedule.installmentCount,
      installmentAmountCents: schedule.firstInstallmentCents,
      annualRateBps: annualRateBps ?? null,
      amortizationSystem: input.amortizationSystem,
      firstDueOn: input.firstDueOn,
    })
    .where(eq(financings.id, financing.id));

  if (schedule.schedule.length === 0) {
    await writeAudit(ctx, {
      action: 'rebuild',
      resourceType: 'financing',
      resourceId: financing.id,
      metadata: { paidKept: paid.length, pendingCreated: 0 },
    });
    return financing;
  }

  const cats = await ctx.db
    .select()
    .from(categories)
    .where(and(eq(categories.householdId, session.householdId), eq(categories.type, 'expense')));
  const categoryId = cats.find((c) => c.name.toLowerCase().includes('financ'))?.id ?? cats[0]?.id;

  const createdInstallments = await ctx.db
    .insert(installments)
    .values(
      schedule.schedule.map((item, index) => ({
        householdId: session.householdId,
        financingId: financing.id,
        number: startNumber + index,
        dueOn: item.dueOn,
        amountCents: item.amountCents,
        interestCents: item.interestCents,
        principalCents: item.principalCents,
        balanceAfterCents: item.balanceAfterCents,
        status: 'pending' as const,
      })),
    )
    .returning();

  if (categoryId) {
    for (const installment of createdInstallments) {
      const [tx] = await ctx.db
        .insert(transactions)
        .values({
          householdId: session.householdId,
          costCenterId: financing.costCenterId,
          categoryId,
          accountId: financing.accountId,
          type: 'expense',
          status: 'pending',
          amountCents: installment.amountCents,
          occurredOn: installment.dueOn,
          dueOn: installment.dueOn,
          paidOn: null,
          description: `Parcela ${installment.number} — ${input.name}`,
          tags: [],
          source: 'financing',
          installmentId: installment.id,
          duplicateHash: duplicateHash({
            occurredOn: installment.dueOn,
            amountCents: installment.amountCents,
            description: `Parcela ${installment.number} — ${input.name}`,
            accountId: financing.accountId,
          }),
          createdBy: session.userId,
        })
        .returning();

      if (tx) {
        await ctx.db
          .update(installments)
          .set({ transactionId: tx.id })
          .where(eq(installments.id, installment.id));
      }
    }
  }

  await writeAudit(ctx, {
    action: 'rebuild',
    resourceType: 'financing',
    resourceId: financing.id,
    metadata: {
      paidKept: paid.length,
      pendingCreated: createdInstallments.length,
      system: input.amortizationSystem,
    },
  });

  return financing;
}

export async function softDeleteFinancing(ctx: AppContext, raw: SoftDeleteFinancingInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'financings.write');
  const input = softDeleteFinancingSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [financing] = await ctx.db
    .select()
    .from(financings)
    .where(
      and(
        eq(financings.id, input.financingId),
        eq(financings.householdId, session.householdId),
        isNull(financings.deletedAt),
      ),
    )
    .limit(1);

  if (!financing) throw new Error('Financiamento não encontrado');

  const pending = await ctx.db
    .select()
    .from(installments)
    .where(
      and(
        eq(installments.financingId, financing.id),
        eq(installments.householdId, session.householdId),
        eq(installments.status, 'pending'),
      ),
    );

  for (const row of pending) {
    if (row.transactionId) {
      await ctx.db
        .update(transactions)
        .set({ deletedAt: new Date(), installmentId: null })
        .where(
          and(
            eq(transactions.id, row.transactionId),
            eq(transactions.householdId, session.householdId),
          ),
        );
    }
  }

  await ctx.db
    .update(financings)
    .set({ deletedAt: new Date() })
    .where(eq(financings.id, financing.id));

  await writeAudit(ctx, {
    action: 'delete',
    resourceType: 'financing',
    resourceId: financing.id,
  });
}

async function assertInvestmentPotAccount(
  ctx: AppContext,
  householdId: string,
  accountId: string,
): Promise<void> {
  const [account] = await ctx.db
    .select({ kind: accounts.kind, isArchived: accounts.isArchived })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.householdId, householdId)));
  if (!account) {
    throw new Error('Conta vinculada não encontrada');
  }
  if (account.isArchived) {
    throw new Error('Conta vinculada está arquivada');
  }
  if (account.kind !== 'investment_pot') {
    throw new Error('Plano deve estar vinculado a uma caixinha');
  }
}

export async function createPlan(ctx: AppContext, raw: CreatePlanInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'plans.write');
  const input = createPlanSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  if (input.financingId) {
    const [financing] = await ctx.db
      .select({ id: financings.id, category: financings.category })
      .from(financings)
      .where(
        and(
          eq(financings.id, input.financingId),
          eq(financings.householdId, session.householdId),
          isNull(financings.deletedAt),
        ),
      );
    if (!financing) {
      throw new Error('Financiamento não encontrado');
    }
    if (input.kind === 'real_estate_amortization' && financing.category !== 'real_estate') {
      throw new Error('Plano de amortização exige financiamento imobiliário');
    }
  }

  let linkedAccountId = input.linkedAccountId ?? null;

  if (input.createLinkedAccount) {
    const costCenterId = input.linkedAccountCostCenterId;
    if (!costCenterId) {
      throw new Error('Centro de custo é obrigatório ao criar caixinha');
    }
    const [center] = await ctx.db
      .select({ id: costCenters.id })
      .from(costCenters)
      .where(
        and(eq(costCenters.id, costCenterId), eq(costCenters.householdId, session.householdId)),
      );
    if (!center) {
      throw new Error('Centro de custo não encontrado');
    }
    const accountName = input.linkedAccountName?.trim() || `Caixinha — ${input.name.trim()}`;
    const [account] = await ctx.db
      .insert(accounts)
      .values({
        householdId: session.householdId,
        costCenterId,
        name: accountName,
        kind: 'investment_pot',
        balanceCents: 0,
        yieldType: 'none',
        allowedPaymentRails: [],
      })
      .returning();
    if (!account) {
      throw new Error('Falha ao criar caixinha');
    }
    linkedAccountId = account.id;
  }

  if (linkedAccountId) {
    await assertInvestmentPotAccount(ctx, session.householdId, linkedAccountId);
  }

  const [plan] = await ctx.db
    .insert(plans)
    .values({
      householdId: session.householdId,
      kind: input.kind,
      name: input.name.trim(),
      targetDate: input.targetDate,
      linkedAccountId,
      financingId: input.financingId ?? null,
      monthlyTargetCents: input.monthlyTargetCents ?? null,
      notes: input.notes?.trim() || null,
    })
    .returning();

  if (!plan) {
    throw new Error('Falha ao criar plano');
  }

  await ctx.db.insert(planItems).values(
    input.items.map((item, index) => ({
      householdId: session.householdId,
      planId: plan.id,
      label: item.label.trim(),
      amountCents: item.amountCents,
      sortOrder: item.sortOrder ?? index,
      categoryId: item.categoryId ?? null,
    })),
  );

  if (input.contributions && input.contributions.length > 0) {
    await ctx.db.insert(planContributions).values(
      input.contributions.map((row, index) => ({
        householdId: session.householdId,
        planId: plan.id,
        dueOn: row.dueOn,
        amountCents: row.amountCents,
        sortOrder: row.sortOrder ?? index,
      })),
    );
  }

  await writeAudit(ctx, {
    action: 'create',
    resourceType: 'plan',
    resourceId: plan.id,
    metadata: { kind: input.kind },
  });

  return plan;
}

export async function updatePlan(ctx: AppContext, raw: UpdatePlanInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'plans.write');
  const input = updatePlanSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [existing] = await ctx.db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.id, input.planId),
        eq(plans.householdId, session.householdId),
        isNull(plans.deletedAt),
      ),
    );
  if (!existing) {
    throw new Error('Plano não encontrado');
  }

  if (input.linkedAccountId) {
    await assertInvestmentPotAccount(ctx, session.householdId, input.linkedAccountId);
  }

  const [updated] = await ctx.db
    .update(plans)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
      ...(input.linkedAccountId !== undefined ? { linkedAccountId: input.linkedAccountId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    })
    .where(eq(plans.id, input.planId))
    .returning();

  await writeAudit(ctx, {
    action: 'update',
    resourceType: 'plan',
    resourceId: input.planId,
  });

  return updated;
}

export async function upsertPlanItems(ctx: AppContext, raw: UpsertPlanItemsInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'plans.write');
  const input = upsertPlanItemsSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [existing] = await ctx.db
    .select({ id: plans.id })
    .from(plans)
    .where(
      and(
        eq(plans.id, input.planId),
        eq(plans.householdId, session.householdId),
        isNull(plans.deletedAt),
      ),
    );
  if (!existing) {
    throw new Error('Plano não encontrado');
  }

  await ctx.db.delete(planItems).where(eq(planItems.planId, input.planId));

  const created = await ctx.db
    .insert(planItems)
    .values(
      input.items.map((item, index) => ({
        householdId: session.householdId,
        planId: input.planId,
        label: item.label.trim(),
        amountCents: item.amountCents,
        sortOrder: item.sortOrder ?? index,
        categoryId: item.categoryId ?? null,
      })),
    )
    .returning();

  await writeAudit(ctx, {
    action: 'upsert_items',
    resourceType: 'plan',
    resourceId: input.planId,
    metadata: { itemCount: created.length },
  });

  return created;
}

export async function upsertPlanContributions(ctx: AppContext, raw: UpsertPlanContributionsInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'plans.write');
  const input = upsertPlanContributionsSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [existing] = await ctx.db
    .select({ id: plans.id })
    .from(plans)
    .where(
      and(
        eq(plans.id, input.planId),
        eq(plans.householdId, session.householdId),
        isNull(plans.deletedAt),
      ),
    );
  if (!existing) {
    throw new Error('Plano não encontrado');
  }

  if (input.monthlyTargetCents !== undefined) {
    await ctx.db
      .update(plans)
      .set({ monthlyTargetCents: input.monthlyTargetCents })
      .where(eq(plans.id, input.planId));
  }

  await ctx.db.delete(planContributions).where(eq(planContributions.planId, input.planId));

  const created = await ctx.db
    .insert(planContributions)
    .values(
      input.contributions.map((row, index) => ({
        householdId: session.householdId,
        planId: input.planId,
        dueOn: row.dueOn,
        amountCents: row.amountCents,
        sortOrder: row.sortOrder ?? index,
      })),
    )
    .returning();

  await writeAudit(ctx, {
    action: 'upsert_contributions',
    resourceType: 'plan',
    resourceId: input.planId,
    metadata: { contributionCount: created.length },
  });

  return created;
}

export async function softDeletePlan(ctx: AppContext, raw: SoftDeletePlanInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'plans.write');
  const input = softDeletePlanSchema.parse({
    ...raw,
    householdId: session.householdId,
  });

  const [existing] = await ctx.db
    .select({ id: plans.id })
    .from(plans)
    .where(
      and(
        eq(plans.id, input.planId),
        eq(plans.householdId, session.householdId),
        isNull(plans.deletedAt),
      ),
    );
  if (!existing) {
    throw new Error('Plano não encontrado');
  }

  await ctx.db.update(plans).set({ deletedAt: new Date() }).where(eq(plans.id, input.planId));

  await writeAudit(ctx, {
    action: 'delete',
    resourceType: 'plan',
    resourceId: input.planId,
  });
}

export { yearMonthFromIso };

export {
  acceptHouseholdInvite,
  acceptHouseholdInviteById,
  createHouseholdInvite,
  listHouseholdMembers,
  listPendingHouseholdInvites,
  listPendingInvitesForEmail,
  peekHouseholdInvite,
  removeMember,
  revokeHouseholdInvite,
  updateMemberRole,
  type HouseholdInviteRow,
  type HouseholdMemberRow,
  type PeekInviteResult,
} from './members';

export * from './queries';

export {
  createCostCenter,
  createCategory,
  createInstitution,
  setupBank,
  updateInstitution,
  createAccount,
  updateAccount,
  updateAccountBalance,
} from './commands/settings';

export {
  updatePreferences,
  updateThemePreference,
  confirmIncomeReceipt,
  snoozeIncomeReceipt,
} from './commands/preferences';

export { createHousehold } from './commands/household';

export {
  commitImport,
  downloadImportTemplate,
  exportTransactions,
  previewImport,
  updateImportPreview,
  type ImportPaymentMethodMapping,
  type ImportPreviewEntityOption,
  type ImportPreviewResult,
  type ImportPreviewRowDto,
} from './imex/use-cases';

export { sendJarvisMessage, type JarvisMessageResult } from './jarvis/chat';
