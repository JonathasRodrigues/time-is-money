import type { PaymentsQuery, PaymentsResponse } from '@tim/api-contract';
import {
  availableCreditCents,
  cardHasCredit,
  dueOnForMonth,
  estimatePayableCents,
  formatAccountPaymentMethodLabel,
  formatCreditCardPaymentMethodLabel,
  resolvePayableKind,
  suggestAverageAmountCents,
  yearMonthFromIso,
} from '@tim/domain';
import {
  accounts,
  categories,
  costCenters,
  creditCardInvoices,
  creditCards,
  institutions,
  paymentMethods as paymentMethodsTable,
  transactions,
} from '@tim/db';
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { resolveCostCenterId, resolveDateRangeWithLegacyMonth } from '@tim/domain';
import { requireSession } from '@tim/auth';
import type { AppContext } from '../context';
import { closeDueCreditCardInvoices, sumInvoiceBalanceCents } from '../card-invoices';
import { ensureAccountPaymentMethods, ensureCreditCardPaymentMethod } from '../payment-methods';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function suggestionKey(categoryId: string, costCenterId: string): string {
  return `${categoryId}:${costCenterId}`;
}

export async function loadPayments(
  ctx: AppContext,
  params: PaymentsQuery,
): Promise<PaymentsResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
  const flow: PaymentsResponse['flow'] =
    params.flow === 'receive' || params.payday === '1' ? 'receive' : 'pay';
  const fromPayday = params.payday === '1';
  const txType = flow === 'receive' ? 'income' : 'expense';
  const range = resolveDateRangeWithLegacyMonth(params);
  const { start, end } = range;
  const today = todayIso();
  const kindFilter =
    params.kind === 'fixed' ||
    params.kind === 'variable' ||
    params.kind === 'installment' ||
    params.kind === 'credit_card_invoice'
      ? params.kind
      : null;

  if (flow === 'pay') {
    await closeDueCreditCardInvoices(ctx, today);
  }

  const [centers, cats, accs, cards, banks] = await Promise.all([
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(categories).where(eq(categories.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
    db
      .select()
      .from(creditCards)
      .where(
        and(eq(creditCards.householdId, session.householdId), eq(creditCards.isArchived, false)),
      ),
    db.select().from(institutions).where(eq(institutions.householdId, session.householdId)),
  ]);

  const centerId = resolveCostCenterId(params.center, new Set(centers.map((c) => c.id)));
  const creditCardId =
    params.card && cards.some((card) => card.id === params.card) ? params.card : null;

  const expenseCats = cats.filter((c) => c.type === 'expense');
  const incomeCats = cats.filter((c) => c.type === 'income');
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  const monthRows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        isNull(transactions.deletedAt),
        eq(transactions.type, txType),
        centerId ? eq(transactions.costCenterId, centerId) : undefined,
        // Filtro de cartão = foco na fatura agrupada; compras do cartão não entram como a pagar.
        gte(transactions.dueOn, start),
        lte(transactions.dueOn, end),
      ),
    )
    .orderBy(asc(transactions.dueOn));

  // Contas a pagar: só obrigações ainda abertas e que NÃO estão no cartão/fatura.
  // Compras no crédito vivem dentro da fatura (uma linha só para quitar tudo).
  const pending = monthRows.filter(
    (row) =>
      row.status === 'pending' && row.creditCardId == null && row.creditCardInvoiceId == null,
  );

  const settledRaw = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        isNull(transactions.deletedAt),
        eq(transactions.type, txType),
        eq(transactions.status, 'paid'),
        isNotNull(transactions.paidOn),
        isNotNull(transactions.amountCents),
        // Compras no crédito não aparecem como “já pago” soltas — estão agrupadas na fatura.
        isNull(transactions.creditCardId),
        centerId ? eq(transactions.costCenterId, centerId) : undefined,
        gte(transactions.paidOn, start),
        lte(transactions.paidOn, end),
      ),
    )
    .orderBy(asc(transactions.paidOn));

  const history = await db
    .select({
      categoryId: transactions.categoryId,
      costCenterId: transactions.costCenterId,
      amountCents: transactions.amountCents,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        isNull(transactions.deletedAt),
        eq(transactions.status, 'paid'),
        eq(transactions.type, txType),
        isNotNull(transactions.amountCents),
      ),
    )
    .limit(500);

  const historyByKey = new Map<string, number[]>();
  for (const row of history) {
    if (row.amountCents == null) continue;
    const key = suggestionKey(row.categoryId, row.costCenterId);
    const list = historyByKey.get(key) ?? [];
    list.push(row.amountCents);
    historyByKey.set(key, list);
  }

  const enrichedPending = pending
    .map((row) => {
      const kind = resolvePayableKind({
        seriesId: row.seriesId,
        installmentId: row.installmentId,
      });
      const suggestedCents = suggestAverageAmountCents(
        historyByKey.get(suggestionKey(row.categoryId, row.costCenterId)) ?? [],
      );
      return {
        ...row,
        kind,
        suggestedCents,
        estimatedCents: estimatePayableCents({
          amountCents: row.amountCents,
          suggestedCents,
        }),
      };
    })
    .filter((row) => !kindFilter || row.kind === kindFilter);

  const knownPendingCents = enrichedPending
    .filter((row) => row.amountCents != null)
    .reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const estimatedGapCents = enrichedPending
    .filter((row) => row.amountCents == null)
    .reduce((sum, row) => sum + row.estimatedCents, 0);

  const accountMap = new Map(accs.map((a) => [a.id, a]));
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const institutionMap = new Map(banks.map((b) => [b.id, b.name]));

  const settledRows = settledRaw
    .map((row) => {
      const kind = resolvePayableKind({
        seriesId: row.seriesId,
        installmentId: row.installmentId,
      });
      const account = accountMap.get(row.accountId);
      const rail = row.paymentRail;
      const paymentRail: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null =
        rail === 'pix' ||
        rail === 'debit' ||
        rail === 'ted' ||
        rail === 'boleto' ||
        rail === 'cash' ||
        rail === 'other'
          ? rail
          : null;
      const paymentMethodLabel = formatAccountPaymentMethodLabel({
        accountName: account?.name ?? 'Conta',
        institutionName: account?.institutionId
          ? (institutionMap.get(account.institutionId) ?? null)
          : null,
        paymentRail,
      });
      return {
        id: row.id,
        dueOn: row.dueOn,
        paidOn: row.paidOn,
        description: row.description,
        kind,
        costCenterId: row.costCenterId,
        costCenterName: centerMap.get(row.costCenterId) ?? '—',
        categoryId: row.categoryId,
        categoryName: catMap.get(row.categoryId) ?? 'Categoria',
        accountId: row.accountId,
        accountName: account?.name ?? 'Conta',
        paymentRail,
        paymentMethodId: row.paymentMethodId ?? null,
        paymentMethodLabel,
        amountCents: row.amountCents ?? 0,
      };
    })
    .filter((row) => {
      if (kindFilter && row.kind !== kindFilter) return false;
      if (!creditCardId) return true;
      const card = cardMap.get(creditCardId);
      if (!card) return false;
      // Foco no cartão: só quitações dessa fatura (não outras contas a pagar).
      return (row.description ?? '').startsWith(`Pagamento fatura ${card.name}`);
    });

  const paidTotalCents = settledRows.reduce((sum, row) => sum + row.amountCents, 0);
  const remainingCents = knownPendingCents + estimatedGapCents;

  const filteredAccounts = centerId ? accs.filter((a) => a.costCenterId === centerId) : accs;
  const sheetAccounts = (filteredAccounts.length ? filteredAccounts : accs).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const pendingAccountIds = new Set(enrichedPending.map((row) => row.accountId));
  const tableAccounts = accs
    .filter((a) => !a.isArchived || pendingAccountIds.has(a.id))
    .map((a) => ({ id: a.id, name: a.name }));

  const creditCardsLookup = cards
    .filter((card) => cardHasCredit(card.cardMode))
    .map((card) => {
      const paymentAccount = accountMap.get(card.paymentAccountId);
      const institutionName = institutionMap.get(card.institutionId) ?? null;
      return {
        id: card.id,
        name: card.name,
        lastFour: card.lastFour,
        paymentAccountId: card.paymentAccountId,
        linkedAccountName: paymentAccount?.name ?? null,
        linkedInstitutionName: institutionName,
        availableCents: availableCreditCents({
          creditLimitCents: card.creditLimitCents,
          invoiceBalanceCents: card.invoiceBalanceCents,
        }),
        label: formatCreditCardPaymentMethodLabel({
          cardName: card.name,
          lastFour: card.lastFour,
          institutionName,
          accountName: paymentAccount?.name ?? null,
        }),
      };
    });

  // Garante formas persistidas (legado / contas criadas antes da migration).
  for (const account of accs) {
    if (account.isArchived) continue;
    await ensureAccountPaymentMethods(db, {
      householdId: session.householdId,
      accountId: account.id,
      kind: account.kind,
    });
  }
  for (const card of cards) {
    if (card.isArchived) continue;
    await ensureCreditCardPaymentMethod(db, {
      householdId: session.householdId,
      creditCardId: card.id,
      paymentAccountId: card.paymentAccountId,
      cardMode: card.cardMode,
    });
  }

  const methodRows = await db
    .select()
    .from(paymentMethodsTable)
    .where(
      and(
        eq(paymentMethodsTable.householdId, session.householdId),
        eq(paymentMethodsTable.isArchived, false),
      ),
    );

  const tableAccountIds = new Set(tableAccounts.map((a) => a.id));
  const paymentMethods: PaymentsResponse['lookups']['paymentMethods'] = methodRows
    .filter((method) => {
      if (method.type === 'account') return tableAccountIds.has(method.accountId);
      if (flow !== 'pay') return false;
      return (
        method.creditCardId != null &&
        cardHasCredit(cards.find((c) => c.id === method.creditCardId)?.cardMode ?? 'debit')
      );
    })
    .map((method) => {
      if (method.type === 'credit_card' && method.creditCardId) {
        const card = creditCardsLookup.find((c) => c.id === method.creditCardId);
        return {
          id: method.id,
          type: 'credit_card' as const,
          accountId: method.accountId,
          creditCardId: method.creditCardId,
          paymentRail: null as 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null,
          linkedAccountName: card?.linkedAccountName ?? null,
          linkedInstitutionName: card?.linkedInstitutionName ?? null,
          balanceCents: card?.availableCents ?? null,
          label: card?.label ?? 'Crédito',
        };
      }
      const account = accountMap.get(method.accountId);
      const institutionName = account?.institutionId
        ? (institutionMap.get(account.institutionId) ?? null)
        : null;
      const rail =
        method.paymentRail === 'pix' ||
        method.paymentRail === 'debit' ||
        method.paymentRail === 'ted' ||
        method.paymentRail === 'boleto' ||
        method.paymentRail === 'cash' ||
        method.paymentRail === 'other'
          ? method.paymentRail
          : null;
      return {
        id: method.id,
        type: 'account' as const,
        accountId: method.accountId,
        creditCardId: null,
        paymentRail: rail,
        linkedAccountName: account?.name ?? 'Conta',
        linkedInstitutionName: institutionName,
        balanceCents: account?.balanceCents ?? 0,
        label: formatAccountPaymentMethodLabel({
          accountName: account?.name ?? 'Conta',
          institutionName,
          paymentRail: rail,
        }),
      };
    });

  let cardInvoice: PaymentsResponse['cardInvoice'] = null;

  const invoiceRows: PaymentsResponse['rows'] = [];
  if (flow === 'pay' && (!kindFilter || kindFilter === 'credit_card_invoice')) {
    const cardsToScan = (
      creditCardId ? cards.filter((card) => card.id === creditCardId) : cards
    ).filter((card) => cardHasCredit(card.cardMode));

    for (const card of cardsToScan) {
      const invoices = await db
        .select()
        .from(creditCardInvoices)
        .where(
          and(
            eq(creditCardInvoices.creditCardId, card.id),
            eq(creditCardInvoices.householdId, session.householdId),
            inArray(creditCardInvoices.status, ['open', 'closed']),
          ),
        )
        .orderBy(asc(creditCardInvoices.dueOn));

      let emittedForCard = false;
      for (const invoice of invoices) {
        const purchaseTotalCents = await sumInvoiceBalanceCents(db, {
          householdId: session.householdId,
          invoiceId: invoice.id,
        });
        const balance = Math.max(0, purchaseTotalCents - invoice.amountPaidCents);
        if (balance <= 0) continue;

        const inPeriod = invoice.dueOn >= start && invoice.dueOn <= end;
        const overdueBeforePeriod = invoice.dueOn < start && invoice.dueOn < today;
        if (!creditCardId && !inPeriod && !overdueBeforePeriod) continue;

        const purchaseLines = await db
          .select({
            id: transactions.id,
            description: transactions.description,
            categoryId: transactions.categoryId,
            occurredOn: transactions.occurredOn,
            paidOn: transactions.paidOn,
            amountCents: transactions.amountCents,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.householdId, session.householdId),
              eq(transactions.creditCardInvoiceId, invoice.id),
              eq(transactions.status, 'paid'),
              isNull(transactions.deletedAt),
            ),
          )
          .orderBy(asc(transactions.paidOn), asc(transactions.occurredOn));

        const purchases = purchaseLines.map((line) => ({
          id: line.id,
          description: line.description,
          categoryName: catMap.get(line.categoryId) ?? 'Categoria',
          occurredOn: line.paidOn ?? line.occurredOn,
          amountCents: line.amountCents ?? 0,
        }));

        const paymentAccount = accountMap.get(card.paymentAccountId);
        const cardLabel = card.lastFour ? `${card.name} ·••• ${card.lastFour}` : card.name;
        invoiceRows.push({
          id: invoice.id,
          dueOn: invoice.dueOn,
          description: `Fatura · ${cardLabel}`,
          kind: 'credit_card_invoice',
          costCenterId: paymentAccount?.costCenterId ?? null,
          costCenterName: paymentAccount
            ? (centerMap.get(paymentAccount.costCenterId) ?? '—')
            : '—',
          categoryId: null,
          categoryName: 'Fatura de cartão',
          accountId: card.paymentAccountId,
          amountCents: balance,
          paymentRail: null,
          paymentMethodId: null,
          suggestedCents: balance,
          estimatedCents: balance,
          creditCardId: card.id,
          creditCardInvoiceId: invoice.id,
          creditCardName: card.name,
          purchaseCount: purchases.length,
          purchases,
        });
        emittedForCard = true;
      }

      if (!emittedForCard && card.invoiceBalanceCents > 0) {
        const dueOn = dueOnForMonth(yearMonthFromIso(today), card.dueDay);
        const inPeriod = dueOn >= start && dueOn <= end;
        if (creditCardId || inPeriod || dueOn < today) {
          const paymentAccount = accountMap.get(card.paymentAccountId);
          const cardLabel = card.lastFour ? `${card.name} ·••• ${card.lastFour}` : card.name;
          invoiceRows.push({
            id: card.id,
            dueOn,
            description: `Fatura · ${cardLabel}`,
            kind: 'credit_card_invoice',
            costCenterId: paymentAccount?.costCenterId ?? null,
            costCenterName: paymentAccount
              ? (centerMap.get(paymentAccount.costCenterId) ?? '—')
              : '—',
            categoryId: null,
            categoryName: 'Fatura de cartão',
            accountId: card.paymentAccountId,
            amountCents: card.invoiceBalanceCents,
            paymentRail: null,
            suggestedCents: card.invoiceBalanceCents,
            estimatedCents: card.invoiceBalanceCents,
            creditCardId: card.id,
            creditCardInvoiceId: null,
            creditCardName: card.name,
            purchaseCount: null,
            purchases: [],
          });
        }
      }
    }
  }

  // Filtro de cartão: só a fatura agrupada (não mistura com outras contas a pagar).
  const transactionRows: PaymentsResponse['rows'] =
    kindFilter === 'credit_card_invoice' || creditCardId
      ? []
      : enrichedPending.map((row) => ({
          id: row.id,
          dueOn: row.dueOn,
          description: row.description,
          kind: row.kind,
          costCenterId: row.costCenterId,
          costCenterName: centerMap.get(row.costCenterId) ?? '—',
          categoryId: row.categoryId,
          categoryName: catMap.get(row.categoryId) ?? 'Categoria',
          accountId: row.accountId,
          amountCents: row.amountCents,
          paymentRail:
            row.paymentRail === 'pix' ||
            row.paymentRail === 'debit' ||
            row.paymentRail === 'ted' ||
            row.paymentRail === 'boleto' ||
            row.paymentRail === 'cash' ||
            row.paymentRail === 'other'
              ? row.paymentRail
              : null,
          paymentMethodId: row.paymentMethodId ?? null,
          suggestedCents: row.suggestedCents,
          estimatedCents: row.estimatedCents,
          creditCardId: null,
          creditCardInvoiceId: null,
          creditCardName: null,
          purchaseCount: null,
          purchases: [],
        }));

  const rows = [...invoiceRows, ...transactionRows].sort((a, b) => {
    const aDue = a.dueOn ?? '9999-99-99';
    const bDue = b.dueOn ?? '9999-99-99';
    return aDue.localeCompare(bDue);
  });

  const invoicePendingCents = invoiceRows.reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const knownPendingWithInvoices = knownPendingCents + invoicePendingCents;
  const remainingWithInvoices = knownPendingWithInvoices + estimatedGapCents;

  return {
    flow,
    fromPayday,
    today,
    range: {
      start: range.start,
      end: range.end,
      period: range.period,
      label: range.label,
    },
    filters: {
      centerId,
      kindFilter,
      creditCardId,
    },
    totals: {
      paidTotalCents,
      knownPendingCents: knownPendingWithInvoices,
      estimatedGapCents,
      remainingCents: remainingWithInvoices,
    },
    cardInvoice,
    rows,
    settledRows,
    lookups: {
      centers: centers.map((c) => ({ id: c.id, name: c.name })),
      expenseCategories: expenseCats.map((c) => ({ id: c.id, name: c.name })),
      incomeCategories: incomeCats.map((c) => ({ id: c.id, name: c.name })),
      sheetAccounts,
      tableAccounts,
      creditCards: creditCardsLookup.map((c) => ({
        id: c.id,
        name: c.name,
        lastFour: c.lastFour,
        paymentAccountId: c.paymentAccountId,
      })),
      paymentMethods,
      defaultCostCenterId: centerId ?? centers[0]?.id,
    },
  };
}
