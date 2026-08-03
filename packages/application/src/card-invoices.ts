import { cardHasCredit, resolveInvoiceCycle, shouldCloseInvoice } from '@tim/domain';
import { accounts, categories, creditCardInvoices, creditCards, transactions } from '@tim/db';
import { and, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { AppContext } from './context.js';

type DbTx = Parameters<Parameters<AppContext['db']['transaction']>[0]>[0];

/** Lançamento sintético do saldo informado no cadastro do cartão (sem compras detalhadas). */
export const INVOICE_OPENING_SOURCE = 'invoice_opening';
export const INVOICE_OPENING_DESCRIPTION = 'Saldo em aberto da fatura';

/** Obtém ou cria a fatura do ciclo que recebe a compra. */
export async function getOrCreateInvoiceForPurchase(
  db: DbTx | AppContext['db'],
  input: {
    householdId: string;
    card: {
      id: string;
      closingDay: number;
      dueDay: number;
      cardMode: 'credit' | 'debit' | 'both';
    };
    purchaseOn: string;
  },
): Promise<{ id: string; closesOn: string; dueOn: string; status: 'open' | 'closed' | 'paid' }> {
  if (!cardHasCredit(input.card.cardMode)) {
    throw new Error('Cartão não possui crédito');
  }

  const cycle = resolveInvoiceCycle({
    closingDay: input.card.closingDay,
    dueDay: input.card.dueDay,
    purchaseOn: input.purchaseOn,
  });

  const [existing] = await db
    .select()
    .from(creditCardInvoices)
    .where(
      and(
        eq(creditCardInvoices.creditCardId, input.card.id),
        eq(creditCardInvoices.closesOn, cycle.closesOn),
        eq(creditCardInvoices.householdId, input.householdId),
      ),
    )
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      closesOn: existing.closesOn,
      dueOn: existing.dueOn,
      status: existing.status,
    };
  }

  const [created] = await db
    .insert(creditCardInvoices)
    .values({
      householdId: input.householdId,
      creditCardId: input.card.id,
      closesOn: cycle.closesOn,
      dueOn: cycle.dueOn,
      status: 'open',
    })
    .returning();

  if (!created) {
    throw new Error('Falha ao criar fatura do cartão');
  }

  return {
    id: created.id,
    closesOn: created.closesOn,
    dueOn: created.dueOn,
    status: created.status,
  };
}

/** Soma compras pagas no ciclo e sincroniza cache do cartão (open+closed − pagos). */
export async function refreshCardInvoiceBalanceCache(
  db: DbTx | AppContext['db'],
  input: { householdId: string; creditCardId: string },
): Promise<number> {
  const openOrClosed = await db
    .select({
      id: creditCardInvoices.id,
      amountPaidCents: creditCardInvoices.amountPaidCents,
    })
    .from(creditCardInvoices)
    .where(
      and(
        eq(creditCardInvoices.creditCardId, input.creditCardId),
        eq(creditCardInvoices.householdId, input.householdId),
        inArray(creditCardInvoices.status, ['open', 'closed']),
      ),
    );

  let balance = 0;
  for (const inv of openOrClosed) {
    const purchases = await sumInvoiceBalanceCents(db, {
      householdId: input.householdId,
      invoiceId: inv.id,
    });
    balance += Math.max(0, purchases - inv.amountPaidCents);
  }

  await db
    .update(creditCards)
    .set({ invoiceBalanceCents: balance, updatedAt: new Date() })
    .where(
      and(eq(creditCards.id, input.creditCardId), eq(creditCards.householdId, input.householdId)),
    );

  return balance;
}

export async function sumInvoiceBalanceCents(
  db: DbTx | AppContext['db'],
  input: { householdId: string; invoiceId: string },
): Promise<number> {
  const [agg] = await db
    .select({
      total: sql<number>`coalesce(sum(${transactions.amountCents}), 0)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, input.householdId),
        isNull(transactions.deletedAt),
        eq(transactions.type, 'expense'),
        eq(transactions.status, 'paid'),
        eq(transactions.creditCardInvoiceId, input.invoiceId),
      ),
    );
  return Number(agg?.total ?? 0);
}

/** Fecha faturas open cujo closes_on já passou. */
export async function closeDueCreditCardInvoices(
  ctx: AppContext,
  todayIso: string,
): Promise<number> {
  const session = ctx.session;
  if (!session?.householdId) return 0;

  const openRows = await ctx.db
    .select()
    .from(creditCardInvoices)
    .where(
      and(
        eq(creditCardInvoices.householdId, session.householdId),
        eq(creditCardInvoices.status, 'open'),
      ),
    );

  let closed = 0;
  for (const row of openRows) {
    if (
      !shouldCloseInvoice({
        status: row.status,
        closesOn: row.closesOn,
        todayIso,
      })
    ) {
      continue;
    }
    await ctx.db
      .update(creditCardInvoices)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(creditCardInvoices.id, row.id));
    closed += 1;
  }
  return closed;
}

/**
 * Materializa saldo informado no cadastro como item da fatura quando ainda não há
 * compras detalhadas. `targetBalanceCents` = total em aberto (cache da fatura).
 */
export async function syncCardInvoiceOpeningBalance(
  db: DbTx | AppContext['db'],
  input: {
    householdId: string;
    userId: string | null;
    card: {
      id: string;
      closingDay: number;
      dueDay: number;
      cardMode: 'credit' | 'debit' | 'both';
      paymentAccountId: string;
      isArchived: boolean;
    };
    targetBalanceCents: number;
    purchaseOn: string;
  },
): Promise<'synced' | 'derived' | 'skipped'> {
  if (!cardHasCredit(input.card.cardMode) || input.card.isArchived) {
    return 'skipped';
  }

  const openOrClosed = await db
    .select({
      id: creditCardInvoices.id,
      amountPaidCents: creditCardInvoices.amountPaidCents,
    })
    .from(creditCardInvoices)
    .where(
      and(
        eq(creditCardInvoices.creditCardId, input.card.id),
        eq(creditCardInvoices.householdId, input.householdId),
        inArray(creditCardInvoices.status, ['open', 'closed']),
      ),
    );

  const invoiceIds = openOrClosed.map((row) => row.id);
  if (invoiceIds.length > 0) {
    const [detailed] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, input.householdId),
          isNull(transactions.deletedAt),
          eq(transactions.type, 'expense'),
          eq(transactions.status, 'paid'),
          inArray(transactions.creditCardInvoiceId, invoiceIds),
          ne(transactions.source, INVOICE_OPENING_SOURCE),
        ),
      )
      .limit(1);

    if (detailed) {
      await refreshCardInvoiceBalanceCache(db, {
        householdId: input.householdId,
        creditCardId: input.card.id,
      });
      return 'derived';
    }
  }

  const targetOutstanding = Math.max(0, input.targetBalanceCents);

  const [opening] = invoiceIds.length
    ? await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, input.householdId),
            isNull(transactions.deletedAt),
            eq(transactions.source, INVOICE_OPENING_SOURCE),
            inArray(transactions.creditCardInvoiceId, invoiceIds),
          ),
        )
        .limit(1)
    : [];

  if (targetOutstanding <= 0) {
    if (opening) {
      await db
        .update(transactions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(transactions.id, opening.id));
    }
    await refreshCardInvoiceBalanceCache(db, {
      householdId: input.householdId,
      creditCardId: input.card.id,
    });
    return opening ? 'synced' : 'skipped';
  }

  const [paymentAccount] = await db
    .select({
      id: accounts.id,
      costCenterId: accounts.costCenterId,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, input.card.paymentAccountId),
        eq(accounts.householdId, input.householdId),
      ),
    )
    .limit(1);
  if (!paymentAccount) {
    return 'skipped';
  }

  const [expenseCat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.householdId, input.householdId), eq(categories.type, 'expense')))
    .limit(1);
  if (!expenseCat) {
    return 'skipped';
  }

  const invoice = await getOrCreateInvoiceForPurchase(db, {
    householdId: input.householdId,
    card: input.card,
    purchaseOn: input.purchaseOn,
  });

  const amountPaidCents =
    openOrClosed.find((row) => row.id === invoice.id)?.amountPaidCents ??
    (
      await db
        .select({ amountPaidCents: creditCardInvoices.amountPaidCents })
        .from(creditCardInvoices)
        .where(eq(creditCardInvoices.id, invoice.id))
        .limit(1)
    )[0]?.amountPaidCents ??
    0;

  /** Item = em aberto + já quitado nesta fatura, para o cache continuar coerente. */
  const openingAmountCents = targetOutstanding + Math.max(0, amountPaidCents);

  if (opening) {
    await db
      .update(transactions)
      .set({
        amountCents: openingAmountCents,
        creditCardInvoiceId: invoice.id,
        accountId: paymentAccount.id,
        costCenterId: paymentAccount.costCenterId,
        categoryId: expenseCat.id,
        occurredOn: input.purchaseOn,
        dueOn: invoice.dueOn,
        paidOn: input.purchaseOn,
        description: INVOICE_OPENING_DESCRIPTION,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, opening.id));
  } else {
    await db.insert(transactions).values({
      householdId: input.householdId,
      costCenterId: paymentAccount.costCenterId,
      categoryId: expenseCat.id,
      accountId: paymentAccount.id,
      creditCardId: input.card.id,
      creditCardInvoiceId: invoice.id,
      paymentRail: null,
      type: 'expense',
      status: 'paid',
      amountCents: openingAmountCents,
      occurredOn: input.purchaseOn,
      dueOn: invoice.dueOn,
      paidOn: input.purchaseOn,
      description: INVOICE_OPENING_DESCRIPTION,
      tags: [],
      source: INVOICE_OPENING_SOURCE,
      createdBy: input.userId,
    });
  }

  await refreshCardInvoiceBalanceCache(db, {
    householdId: input.householdId,
    creditCardId: input.card.id,
  });
  return 'synced';
}

/**
 * Import / dados antigos: compra com `credit_card_id` mas sem `credit_card_invoice_id`.
 * Amarra cada uma ao ciclo correto e recalcula o cache da fatura.
 * Comando de reparo (one-shot) — não chamar em queries de listagem.
 */
export async function linkOrphanCardPurchasesForHousehold(
  db: AppContext['db'],
  householdId: string,
): Promise<{ linked: number; cards: number }> {
  const orphans = await db
    .select({
      id: transactions.id,
      creditCardId: transactions.creditCardId,
      paidOn: transactions.paidOn,
      occurredOn: transactions.occurredOn,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        isNull(transactions.deletedAt),
        eq(transactions.type, 'expense'),
        eq(transactions.status, 'paid'),
        isNotNull(transactions.creditCardId),
        isNull(transactions.creditCardInvoiceId),
      ),
    );

  if (orphans.length === 0) return { linked: 0, cards: 0 };

  const withCard = orphans.filter(
    (row): row is typeof row & { creditCardId: string } => row.creditCardId != null,
  );

  const cardIds = [...new Set(withCard.map((row) => row.creditCardId))];
  const cards = await db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.householdId, householdId), inArray(creditCards.id, cardIds)));
  const cardById = new Map(cards.map((card) => [card.id, card]));

  let linked = 0;
  const touchedCards = new Set<string>();

  for (const row of withCard) {
    const card = cardById.get(row.creditCardId);
    if (!card || !cardHasCredit(card.cardMode)) continue;

    const purchaseOn = row.paidOn ?? row.occurredOn;
    const invoice = await getOrCreateInvoiceForPurchase(db, {
      householdId,
      card,
      purchaseOn,
    });

    await db
      .update(transactions)
      .set({ creditCardInvoiceId: invoice.id, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.id, row.id),
          eq(transactions.householdId, householdId),
          isNull(transactions.creditCardInvoiceId),
        ),
      );

    linked += 1;
    touchedCards.add(card.id);
  }

  for (const creditCardId of touchedCards) {
    await refreshCardInvoiceBalanceCache(db, { householdId, creditCardId });
  }

  return { linked, cards: touchedCards.size };
}

/** Wrapper de sessão para o comando de reparo. */
export async function linkOrphanCardPurchasesToInvoices(
  ctx: AppContext,
): Promise<{ linked: number; cards: number }> {
  const session = ctx.session;
  if (!session?.householdId) return { linked: 0, cards: 0 };
  return linkOrphanCardPurchasesForHousehold(ctx.db, session.householdId);
}

/** Cartões com saldo em cache e sem nenhum item: materializa saldo inicial. */
export async function materializeLegacyCardInvoiceBalances(
  ctx: AppContext,
  todayIso: string,
): Promise<number> {
  const session = ctx.session;
  if (!session?.householdId) return 0;

  const cards = await ctx.db
    .select()
    .from(creditCards)
    .where(
      and(eq(creditCards.householdId, session.householdId), eq(creditCards.isArchived, false)),
    );

  let synced = 0;
  for (const card of cards) {
    if (!cardHasCredit(card.cardMode) || card.invoiceBalanceCents <= 0) continue;

    const invoices = await ctx.db
      .select({ id: creditCardInvoices.id })
      .from(creditCardInvoices)
      .where(
        and(
          eq(creditCardInvoices.creditCardId, card.id),
          eq(creditCardInvoices.householdId, session.householdId),
          inArray(creditCardInvoices.status, ['open', 'closed']),
        ),
      );

    const invoiceIds = invoices.map((row) => row.id);
    if (invoiceIds.length > 0) {
      const [existingItem] = await ctx.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, session.householdId),
            isNull(transactions.deletedAt),
            inArray(transactions.creditCardInvoiceId, invoiceIds),
          ),
        )
        .limit(1);
      if (existingItem) continue;
    }

    const result = await syncCardInvoiceOpeningBalance(ctx.db, {
      householdId: session.householdId,
      userId: session.userId,
      card,
      targetBalanceCents: card.invoiceBalanceCents,
      purchaseOn: todayIso,
    });
    if (result === 'synced') synced += 1;
  }
  return synced;
}
