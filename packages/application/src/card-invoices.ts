import { cardHasCredit, resolveInvoiceCycle, shouldCloseInvoice } from '@tim/domain';
import { creditCardInvoices, creditCards, transactions } from '@tim/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AppContext } from './context.js';

type DbTx = Parameters<Parameters<AppContext['db']['transaction']>[0]>[0];

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
