import { paymentMethods, type DbClient } from '@tim/db';
import {
  INSTANT_ACCOUNT_PAYMENT_RAILS,
  cardHasCredit,
  defaultAllowedPaymentRails,
  normalizeAllowedPaymentRails,
  type CardMode,
  type InstantAccountPaymentRail,
} from '@tim/domain';
import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm';

const BALANCE_ACCOUNT_KINDS = new Set(['checking', 'savings', 'cash']);

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
  const now = new Date();

  if (rails.length > 0) {
    await db
      .insert(paymentMethods)
      .values(
        rails.map((rail) => ({
          householdId: input.householdId,
          type: 'account' as const,
          accountId: input.accountId,
          creditCardId: null,
          paymentRail: rail,
          isArchived: false,
        })),
      )
      .onConflictDoNothing({
        target: [paymentMethods.accountId, paymentMethods.paymentRail],
      });

    await db
      .update(paymentMethods)
      .set({ isArchived: false, updatedAt: now })
      .where(
        and(
          eq(paymentMethods.householdId, input.householdId),
          eq(paymentMethods.type, 'account'),
          eq(paymentMethods.accountId, input.accountId),
          inArray(paymentMethods.paymentRail, rails),
        ),
      );

    await db
      .update(paymentMethods)
      .set({ isArchived: true, updatedAt: now })
      .where(
        and(
          eq(paymentMethods.householdId, input.householdId),
          eq(paymentMethods.type, 'account'),
          eq(paymentMethods.accountId, input.accountId),
          notInArray(paymentMethods.paymentRail, rails),
        ),
      );
    return;
  }

  await db
    .update(paymentMethods)
    .set({ isArchived: true, updatedAt: now })
    .where(
      and(
        eq(paymentMethods.householdId, input.householdId),
        eq(paymentMethods.type, 'account'),
        eq(paymentMethods.accountId, input.accountId),
      ),
    );
}

/** Cria meios PIX/débito/TED/boleto para uma conta (ou os rails informados). */
export async function ensureAccountPaymentMethods(
  db: DbClient,
  input: {
    householdId: string;
    accountId: string;
    kind: string;
    rails?: readonly InstantAccountPaymentRail[];
  },
): Promise<void> {
  const rails =
    input.rails !== undefined
      ? normalizeAllowedPaymentRails(input.rails)
      : BALANCE_ACCOUNT_KINDS.has(input.kind)
        ? defaultAllowedPaymentRails(
            input.kind as 'cash' | 'checking' | 'savings' | 'investment_pot',
          )
        : [];

  await syncAccountPaymentMethods(db, {
    householdId: input.householdId,
    accountId: input.accountId,
    rails,
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

/** @internal — mantém a constante exportável para seeds legados. */
export const ACCOUNT_PAYMENT_RAILS = INSTANT_ACCOUNT_PAYMENT_RAILS;
