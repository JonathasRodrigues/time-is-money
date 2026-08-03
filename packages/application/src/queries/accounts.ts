import {
  availableCreditCents,
  coerceAllowedPaymentRails,
  formatYieldLabel,
  type YieldType,
} from '@tim/domain';
import type { AccountsResponse } from '@tim/api-contract';
import { accounts, costCenters, creditCards, institutions } from '@tim/db';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@tim/auth';
import type { AppContext } from '../context';

type AccountRow = typeof accounts.$inferSelect;
type CardRow = typeof creditCards.$inferSelect;

function sortAccountsTree(rows: AccountRow[]): AccountRow[] {
  const children = new Map<string | null, AccountRow[]>();
  for (const row of rows) {
    const key = row.parentAccountId;
    const list = children.get(key) ?? [];
    list.push(row);
    children.set(key, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  const result: AccountRow[] = [];
  function walk(parentId: string | null): void {
    const list = children.get(parentId) ?? [];
    for (const row of list) {
      result.push(row);
      walk(row.id);
    }
  }

  const ids = new Set(rows.map((row) => row.id));
  const roots = rows.filter((row) => !row.parentAccountId || !ids.has(row.parentAccountId));
  roots.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  for (const root of roots) {
    result.push(root);
    walk(root.id);
  }

  const seen = new Set<string>();
  return result.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function loadAccounts(ctx: AppContext): Promise<AccountsResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
  const [centers, banks, rows, cards] = await Promise.all([
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(institutions).where(eq(institutions.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
    db
      .select()
      .from(creditCards)
      .where(
        and(eq(creditCards.householdId, session.householdId), eq(creditCards.isArchived, false)),
      ),
  ]);

  const centerMap = new Map(centers.map((center) => [center.id, center.name]));
  const parents = rows.filter((row) => row.kind !== 'investment_pot');
  const centerOptions = centers.map((center) => ({ id: center.id, name: center.name }));
  const bankOptions = banks.map((bank) => ({ id: bank.id, name: bank.name }));
  const parentOptions = parents.map((account) => ({ id: account.id, name: account.name }));
  const paymentAccountOptions = rows
    .filter((row) => row.kind === 'checking' || row.kind === 'cash' || row.kind === 'savings')
    .map((account) => ({ id: account.id, name: account.name }));
  const defaultPaymentAccountId =
    paymentAccountOptions.find(
      (account) => rows.find((row) => row.id === account.id)?.kind === 'checking',
    )?.id ?? paymentAccountOptions[0]?.id;

  const byBank = new Map<string, AccountRow[]>();
  for (const row of rows) {
    const key = row.institutionId ?? 'none';
    const list = byBank.get(key) ?? [];
    list.push(row);
    byBank.set(key, list);
  }

  const cardsByBank = new Map<string, CardRow[]>();
  for (const card of cards) {
    const list = cardsByBank.get(card.institutionId) ?? [];
    list.push(card);
    cardsByBank.set(card.institutionId, list);
  }

  const mapAccounts = (
    sectionAccounts: AccountRow[],
  ): AccountsResponse['bankSections'][number]['accounts'] =>
    sortAccountsTree(sectionAccounts).map((row) => {
      const isChild = Boolean(
        row.parentAccountId &&
        sectionAccounts.some((account) => account.id === row.parentAccountId),
      );
      const yieldType = row.yieldType as YieldType;
      return {
        id: row.id,
        name: row.name,
        kind: row.kind as AccountsResponse['bankSections'][number]['accounts'][number]['kind'],
        costCenterId: row.costCenterId,
        costCenterName: centerMap.get(row.costCenterId) ?? '—',
        institutionId: row.institutionId,
        parentAccountId: row.parentAccountId,
        balanceCents: row.balanceCents,
        yieldType:
          row.yieldType as AccountsResponse['bankSections'][number]['accounts'][number]['yieldType'],
        yieldBps: row.yieldBps,
        yieldLabel: formatYieldLabel(yieldType, row.yieldBps),
        allowedPaymentRails: coerceAllowedPaymentRails(row.allowedPaymentRails),
        isChild,
      };
    });

  const mapCards = (
    sectionCards: CardRow[],
  ): AccountsResponse['bankSections'][number]['creditCards'] =>
    sectionCards.map((card) => ({
      id: card.id,
      name: card.name,
      institutionId: card.institutionId,
      paymentAccountId: card.paymentAccountId,
      lastFour: card.lastFour,
      cardMode: card.cardMode,
      creditLimitCents: card.creditLimitCents,
      invoiceBalanceCents: card.invoiceBalanceCents,
      availableCents: availableCreditCents({
        creditLimitCents: card.creditLimitCents,
        invoiceBalanceCents: card.invoiceBalanceCents,
      }),
      closingDay: card.closingDay,
      dueDay: card.dueDay,
    }));

  const bankSections: AccountsResponse['bankSections'] = [
    ...banks.map((bank) => ({
      key: bank.id,
      title: bank.name,
      institutionId: bank.id,
      editable: true as const,
      accounts: mapAccounts(byBank.get(bank.id) ?? []),
      creditCards: mapCards(cardsByBank.get(bank.id) ?? []),
    })),
    {
      key: 'none',
      title: 'Sem banco',
      institutionId: null,
      editable: false as const,
      accounts: mapAccounts(byBank.get('none') ?? []),
      creditCards: [],
    },
  ].filter(
    (section) => section.accounts.length > 0 || section.creditCards.length > 0 || section.editable,
  );

  return {
    institutions: banks.map((bank) => ({ id: bank.id, name: bank.name })),
    bankSections,
    lookups: {
      centers: centerOptions,
      banks: bankOptions,
      parentOptions,
      paymentAccountOptions,
      defaultPaymentAccountId,
    },
    isEmpty: banks.length === 0 && rows.length === 0,
  };
}
