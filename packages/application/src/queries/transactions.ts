import type { TransactionsQuery, TransactionsResponse } from '@tim/api-contract';
import {
  accounts,
  categories,
  costCenters,
  creditCards,
  institutions,
  transactions,
} from '@tim/db';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  sum,
} from 'drizzle-orm';
import { resolveCostCenterId, resolveDateRange } from '@tim/domain';
import { requireSession, can } from '@tim/auth';
import type { AppContext } from '../context';

const LIST_LIMIT = 500;

const RAIL_VALUES = new Set(['pix', 'debit', 'ted', 'boleto', 'cash', 'other', 'credit_card']);

export async function loadTransactions(
  ctx: AppContext,
  params: TransactionsQuery,
): Promise<TransactionsResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
  const range = resolveDateRange(params);
  const canEdit = can(session, 'transactions.write');

  const typeFilter = params.type === 'income' || params.type === 'expense' ? params.type : null;
  const statusFilter =
    params.status === 'pending' || params.status === 'paid' ? params.status : null;
  const searchQuery = (params.q ?? '').trim();
  const railFilter =
    params.rail && RAIL_VALUES.has(params.rail)
      ? (params.rail as TransactionsResponse['filters']['railFilter'])
      : null;

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

  const centerId = resolveCostCenterId(params.center, new Set(centers.map((center) => center.id)));
  const categoryIds = new Set(cats.map((category) => category.id));
  const categoryFilter =
    params.category && categoryIds.has(params.category) ? params.category : null;

  const bankIds = new Set(banks.map((bank) => bank.id));
  const bankFilter = params.bank && bankIds.has(params.bank) ? params.bank : null;

  const accountIds = new Set(accs.map((account) => account.id));
  const accountFilter = params.account && accountIds.has(params.account) ? params.account : null;

  const cardIds = new Set(cards.map((card) => card.id));
  const cardFilter = params.card && cardIds.has(params.card) ? params.card : null;

  const activeCenterName = centerId
    ? (centers.find((center) => center.id === centerId)?.name ?? null)
    : null;
  const activeBankName = bankFilter
    ? (banks.find((bank) => bank.id === bankFilter)?.name ?? null)
    : null;

  const bankAccountIds = bankFilter
    ? accs.filter((account) => account.institutionId === bankFilter).map((account) => account.id)
    : [];
  const bankCardIds = bankFilter
    ? cards.filter((card) => card.institutionId === bankFilter).map((card) => card.id)
    : [];

  const filters = and(
    eq(transactions.householdId, session.householdId),
    isNull(transactions.deletedAt),
    centerId ? eq(transactions.costCenterId, centerId) : undefined,
    typeFilter ? eq(transactions.type, typeFilter) : undefined,
    statusFilter ? eq(transactions.status, statusFilter) : undefined,
    categoryFilter ? eq(transactions.categoryId, categoryFilter) : undefined,
    searchQuery ? ilike(transactions.description, `%${searchQuery}%`) : undefined,
    accountFilter ? eq(transactions.accountId, accountFilter) : undefined,
    cardFilter ? eq(transactions.creditCardId, cardFilter) : undefined,
    railFilter === 'credit_card'
      ? isNotNull(transactions.creditCardId)
      : railFilter
        ? eq(transactions.paymentRail, railFilter)
        : undefined,
    bankFilter
      ? or(
          bankAccountIds.length > 0 ? inArray(transactions.accountId, bankAccountIds) : sql`false`,
          bankCardIds.length > 0 ? inArray(transactions.creditCardId, bankCardIds) : sql`false`,
        )
      : undefined,
    gte(transactions.occurredOn, range.start),
    lte(transactions.occurredOn, range.end),
  );

  const [rows, totalsRow] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(filters)
      .orderBy(desc(transactions.occurredOn), asc(transactions.description))
      .limit(LIST_LIMIT),
    db
      .select({
        total: count(),
        incomeCents: sum(
          sql`case when ${transactions.type} = 'income' and ${transactions.amountCents} is not null then ${transactions.amountCents} else 0 end`,
        ),
        expenseCents: sum(
          sql`case when ${transactions.type} = 'expense' and ${transactions.amountCents} is not null then ${transactions.amountCents} else 0 end`,
        ),
      })
      .from(transactions)
      .where(filters),
  ]);

  const totalCount = Number(totalsRow[0]?.total ?? 0);
  const incomeCents = Number(totalsRow[0]?.incomeCents ?? 0);
  const expenseCents = Number(totalsRow[0]?.expenseCents ?? 0);
  const truncated = totalCount > rows.length;

  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const scopeLabel = [range.label, activeCenterName, activeBankName].filter(Boolean).join(' · ');

  return {
    canEdit,
    range: {
      start: range.start,
      end: range.end,
      period: range.period,
      label: range.label,
    },
    scopeLabel,
    totals: { totalCount, incomeCents, expenseCents, truncated },
    rows: rows.map((row) => {
      const displayDate =
        row.status === 'paid' ? (row.paidOn ?? row.occurredOn) : (row.dueOn ?? row.occurredOn);
      const displayDateKind =
        row.status === 'paid'
          ? row.type === 'income'
            ? ('receipt' as const)
            : ('payment' as const)
          : ('due' as const);
      return {
        id: row.id,
        type: row.type,
        status: row.status,
        amountCents: row.amountCents,
        occurredOn: row.occurredOn,
        dueOn: row.dueOn,
        paidOn: row.paidOn,
        displayDate,
        displayDateKind,
        description: row.description,
        categoryId: row.categoryId,
        categoryName: catMap.get(row.categoryId) ?? '—',
        costCenterId: row.costCenterId,
        costCenterName: centerMap.get(row.costCenterId) ?? '—',
        accountId: row.accountId,
        installmentId: row.installmentId,
      };
    }),
    filters: {
      centerId,
      typeFilter,
      statusFilter,
      categoryFilter,
      searchQuery,
      bankFilter,
      accountFilter,
      railFilter,
      cardFilter,
    },
    lookups: {
      centers: centers.map((c) => ({ id: c.id, name: c.name })),
      categories: cats.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      banks: banks.map((b) => ({ id: b.id, name: b.name })),
      accounts: (() => {
        const forCenter = accs.filter((account) => !centerId || account.costCenterId === centerId);
        return (forCenter.length > 0 ? forCenter : accs).map((a) => ({
          id: a.id,
          name: a.name,
          institutionId: a.institutionId,
        }));
      })(),
      creditCards: cards.map((card) => ({
        id: card.id,
        name: card.name,
        paymentAccountId: card.paymentAccountId,
        institutionId: card.institutionId,
        lastFour: card.lastFour,
      })),
      defaultCostCenterId: centerId ?? centers[0]?.id,
      defaultOccurredOn: range.end,
    },
  };
}
