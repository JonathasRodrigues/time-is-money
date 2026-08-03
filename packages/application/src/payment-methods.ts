import { paymentMethods, type DbClient } from '@tim/db';
import {
  cardHasCredit,
  normalizeAllowedPaymentRails,
  type CardMode,
  type InstantAccountPaymentRail,
} from '@tim/domain';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Sincroniza meios account+rail com a lista permitida da conta.
 * Rails ausentes são arquivados; rails marcados são criados/desarquivados.
 */
export async function syncAccountPaymentMethods(
  db: DbClient,
  input: {
    householdId: string;
    accountId: string;
    rails: readonly InstantAccountPaymentRail[];
  },
): Promise<void> {
  const rails = normalizeAllowedPaymentRails(input.rails);
  const allowed = new Set<string>(rails);
  const now = new Date();

  const existing = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.householdId, input.householdId),
        eq(paymentMethods.type, 'account'),
        eq(paymentMethods.accountId, input.accountId),
      ),
    );

  const byRail = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    if (row.paymentRail == null) continue;
    byRail.set(row.paymentRail, row);
  }

  for (const rail of rails) {
    const row = byRail.get(rail);
    if (!row) {
      await db.insert(paymentMethods).values({
        householdId: input.householdId,
        type: 'account',
        accountId: input.accountId,
        creditCardId: null,
        paymentRail: rail,
        isArchived: false,
      });
      continue;
    }
    if (row.isArchived) {
      await db
        .update(paymentMethods)
        .set({ isArchived: false, updatedAt: now })
        .where(eq(paymentMethods.id, row.id));
    }
  }

  for (const row of existing) {
    if (row.paymentRail == null) continue;
    if (allowed.has(row.paymentRail)) continue;
    if (row.isArchived) continue;
    await db
      .update(paymentMethods)
      .set({ isArchived: true, updatedAt: now })
      .where(eq(paymentMethods.id, row.id));
  }
}

/**
 * Sincroniza meios da conta com `rails`.
 * Sem `rails`, não inventa os 4 padrões (evita desfazer a config da conta).
 */
export async function ensureAccountPaymentMethods(
  db: DbClient,
  input: {
    householdId: string;
    accountId: string;
    kind: string;
    rails?: readonly InstantAccountPaymentRail[];
  },
): Promise<void> {
  if (input.rails === undefined) return;

  await syncAccountPaymentMethods(db, {
    householdId: input.householdId,
    accountId: input.accountId,
    rails: normalizeAllowedPaymentRails(input.rails),
  });
}

/** Cria forma de crédito para o cartão (quando tem crédito). */
export async function ensureCreditCardPaymentMethod(
  db: DbClient,
  input: {
    householdId: string;
    creditCardId: string;
    paymentAccountId: string;
    cardMode: CardMode;
  },
): Promise<void> {
  if (!cardHasCredit(input.cardMode)) return;

  const [existing] = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.householdId, input.householdId),
        eq(paymentMethods.creditCardId, input.creditCardId),
      ),
    )
    .limit(1);
  if (existing) return;

  await db.insert(paymentMethods).values({
    householdId: input.householdId,
    type: 'credit_card',
    accountId: input.paymentAccountId,
    creditCardId: input.creditCardId,
    paymentRail: null,
  });
}

/** Resolve forma por id no household. */
export async function getPaymentMethodById(
  db: DbClient,
  householdId: string,
  paymentMethodId: string,
) {
  const [row] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, paymentMethodId),
        eq(paymentMethods.householdId, householdId),
        eq(paymentMethods.isArchived, false),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Resolve forma account+rail (legado / fallback). */
export async function findAccountPaymentMethod(
  db: DbClient,
  householdId: string,
  accountId: string,
  paymentRail: string | null | undefined,
) {
  const rail = paymentRail ?? 'pix';
  const [row] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.householdId, householdId),
        eq(paymentMethods.type, 'account'),
        eq(paymentMethods.accountId, accountId),
        eq(paymentMethods.paymentRail, rail),
        eq(paymentMethods.isArchived, false),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findCreditCardPaymentMethod(
  db: DbClient,
  householdId: string,
  creditCardId: string,
) {
  const [row] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.householdId, householdId),
        eq(paymentMethods.type, 'credit_card'),
        eq(paymentMethods.creditCardId, creditCardId),
        eq(paymentMethods.isArchived, false),
        isNull(paymentMethods.paymentRail),
      ),
    )
    .limit(1);
  return row ?? null;
}
