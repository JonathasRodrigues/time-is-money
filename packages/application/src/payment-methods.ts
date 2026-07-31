import { paymentMethods, type DbClient } from '@tim/db';
import { INSTANT_ACCOUNT_PAYMENT_RAILS, cardHasCredit, type CardMode } from '@tim/domain';
import { and, eq, isNull } from 'drizzle-orm';

const BALANCE_ACCOUNT_KINDS = new Set(['checking', 'savings', 'cash']);

/** Cria meios PIX/débito/TED/boleto para uma conta que move saldo. */
export async function ensureAccountPaymentMethods(
  db: DbClient,
  input: {
    householdId: string;
    accountId: string;
    kind: string;
  },
): Promise<void> {
  if (!BALANCE_ACCOUNT_KINDS.has(input.kind)) return;

  await db
    .insert(paymentMethods)
    .values(
      INSTANT_ACCOUNT_PAYMENT_RAILS.map((rail) => ({
        householdId: input.householdId,
        type: 'account' as const,
        accountId: input.accountId,
        creditCardId: null,
        paymentRail: rail,
      })),
    )
    .onConflictDoNothing({
      target: [paymentMethods.accountId, paymentMethods.paymentRail],
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
