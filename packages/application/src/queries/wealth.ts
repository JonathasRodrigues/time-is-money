import {
  ACCOUNT_KIND_LABEL,
  availableCreditCents,
  cardHasCredit,
  estimateMonthlyYieldCents,
  formatBrlFromCents,
  formatYieldLabel,
  netWorthCents,
  type AccountKind,
  type YieldType,
} from '@tim/domain';
import type { WealthResponse } from '@tim/api-contract';
import { accountTransfers, accounts, costCenters, creditCards, institutions } from '@tim/db';
import { and, desc, eq } from 'drizzle-orm';
import { requireSession } from '@tim/auth';
import type { AppContext } from '../context';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function accountOptionLabel(row: { name: string; kind: string; balanceCents: number }): string {
  const kind =
    row.kind === 'investment_pot'
      ? 'caixinha'
      : (ACCOUNT_KIND_LABEL[row.kind as AccountKind] ?? row.kind);
  return `${row.name} (${kind}) · ${formatBrlFromCents(row.balanceCents)}`;
}

export async function loadWealth(ctx: AppContext): Promise<WealthResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;

  const [rows, banks, centers, transfers, cards] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.householdId, session.householdId), eq(accounts.isArchived, false))),
    db.select().from(institutions).where(eq(institutions.householdId, session.householdId)),
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db
      .select()
      .from(accountTransfers)
      .where(eq(accountTransfers.householdId, session.householdId))
      .orderBy(desc(accountTransfers.occurredOn), desc(accountTransfers.createdAt))
      .limit(20),
    db
      .select()
      .from(creditCards)
      .where(
        and(eq(creditCards.householdId, session.householdId), eq(creditCards.isArchived, false)),
      ),
  ]);

  const bankMap = new Map(banks.map((b) => [b.id, b.name]));
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const total = rows.reduce((sum, row) => sum + row.balanceCents, 0);
  const invested = rows
    .filter((row) => row.kind === 'investment_pot')
    .reduce((sum, row) => sum + row.balanceCents, 0);
  const liquid = total - invested;
  const liabilities = cards.reduce(
    (sum, card) => (cardHasCredit(card.cardMode) ? sum + card.invoiceBalanceCents : sum),
    0,
  );
  const net = netWorthCents({ assetsCents: total, liabilitiesCents: liabilities });
  const monthlyYield = rows.reduce(
    (sum, row) =>
      sum +
      estimateMonthlyYieldCents({
        balanceCents: row.balanceCents,
        yieldType: row.yieldType as YieldType,
        yieldBps: row.yieldBps,
      }),
    0,
  );

  const byBank = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.institutionId ?? 'none';
    const list = byBank.get(key) ?? [];
    list.push(row);
    byBank.set(key, list);
  }

  const cardsByBank = new Map<string, typeof cards>();
  for (const card of cards) {
    const list = cardsByBank.get(card.institutionId) ?? [];
    list.push(card);
    cardsByBank.set(card.institutionId, list);
    if (!byBank.has(card.institutionId)) {
      byBank.set(card.institutionId, []);
    }
  }

  const paymentAccountOptions = rows
    .filter((r) => r.kind === 'checking' || r.kind === 'cash' || r.kind === 'savings')
    .map((a) => ({ id: a.id, name: a.name }));

  const defaultFrom = rows.find((r) => r.kind === 'checking')?.id ?? rows[0]?.id ?? '';
  const defaultTo =
    rows.find((r) => r.kind === 'investment_pot' && r.id !== defaultFrom)?.id ??
    rows.find((r) => r.id !== defaultFrom)?.id ??
    '';

  const bankGroups = Array.from(byBank.entries()).map(([bankId, list]) => {
    const bankName = bankId === 'none' ? 'Sem banco' : (bankMap.get(bankId) ?? 'Banco');
    const bankTotal = list.reduce((sum, row) => sum + row.balanceCents, 0);
    const bankCards = bankId === 'none' ? [] : (cardsByBank.get(bankId) ?? []);

    return {
      bankId,
      bankName,
      bankTotalCents: bankTotal,
      accounts: list.map((row) => {
        const parent = row.parentAccountId ? byId.get(row.parentAccountId) : null;
        const yieldType = row.yieldType as YieldType;
        const monthlyYieldCents = estimateMonthlyYieldCents({
          balanceCents: row.balanceCents,
          yieldType,
          yieldBps: row.yieldBps,
        });
        return {
          id: row.id,
          name: row.name,
          kind: row.kind as WealthResponse['bankGroups'][number]['accounts'][number]['kind'],
          balanceCents: row.balanceCents,
          costCenterId: row.costCenterId,
          costCenterName: centerMap.get(row.costCenterId) ?? '—',
          institutionId: row.institutionId,
          parentAccountId: row.parentAccountId,
          parentName: parent?.name ?? null,
          yieldType:
            row.yieldType as WealthResponse['bankGroups'][number]['accounts'][number]['yieldType'],
          yieldBps: row.yieldBps,
          monthlyYieldCents,
          yieldLabel: formatYieldLabel(yieldType, row.yieldBps),
        };
      }),
      creditCards: bankCards.map((card) => ({
        id: card.id,
        name: card.name,
        institutionId: card.institutionId,
        lastFour: card.lastFour,
        cardMode: card.cardMode,
        invoiceBalanceCents: cardHasCredit(card.cardMode) ? card.invoiceBalanceCents : 0,
        availableCents: cardHasCredit(card.cardMode)
          ? availableCreditCents({
              creditLimitCents: card.creditLimitCents,
              invoiceBalanceCents: card.invoiceBalanceCents,
            })
          : 0,
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        paymentAccountId: card.paymentAccountId,
      })),
    };
  });

  return {
    summary: {
      assetsCents: total,
      liabilitiesCents: liabilities,
      netCents: net,
      liquidCents: liquid,
      investedCents: invested,
      monthlyYieldCents: monthlyYield,
    },
    bankGroups,
    transfers: transfers.map((row) => ({
      id: row.id,
      fromAccountId: row.fromAccountId,
      toAccountId: row.toAccountId,
      fromName: byId.get(row.fromAccountId)?.name ?? 'Conta',
      toName: byId.get(row.toAccountId)?.name ?? 'Conta',
      amountCents: row.amountCents,
      occurredOn: row.occurredOn,
      description: row.description,
    })),
    transferForm: {
      accounts: rows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind as WealthResponse['transferForm']['accounts'][number]['kind'],
        balanceCents: row.balanceCents,
        label: accountOptionLabel(row),
      })),
      defaultFromId: defaultFrom,
      defaultToId: defaultTo,
      today: todayIso(),
    },
    paymentAccountOptions,
    isEmpty: rows.length === 0,
  };
}
