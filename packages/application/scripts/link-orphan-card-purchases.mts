/**
 * One-shot: amarra compras com credit_card_id e sem credit_card_invoice_id ao ciclo.
 *
 * Uso:
 *   DATABASE_URL='postgresql://…' pnpm db:link-orphan-invoices
 *
 * Opcional: HOUSEHOLD_ID=<uuid> para limitar a um household.
 */
import { createDb, households, transactions } from '@tim/db';
import { linkOrphanCardPurchasesForHousehold } from '../src/card-invoices.js';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL é obrigatório');
    process.exit(1);
  }

  const onlyHousehold = process.env.HOUSEHOLD_ID?.trim() || null;
  const db = createDb(databaseUrl);

  const householdIds = onlyHousehold
    ? [onlyHousehold]
    : (
        await db
          .selectDistinct({ householdId: transactions.householdId })
          .from(transactions)
          .where(
            and(
              isNull(transactions.deletedAt),
              eq(transactions.type, 'expense'),
              eq(transactions.status, 'paid'),
              isNotNull(transactions.creditCardId),
              isNull(transactions.creditCardInvoiceId),
            ),
          )
      ).map((row) => row.householdId);

  if (householdIds.length === 0) {
    console.log('Nenhuma compra órfã encontrada.');
    process.exit(0);
  }

  let totalLinked = 0;
  let totalCards = 0;

  for (const householdId of householdIds) {
    const [house] = await db
      .select({ id: households.id, name: households.name })
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);

    const result = await linkOrphanCardPurchasesForHousehold(db, householdId);
    totalLinked += result.linked;
    totalCards += result.cards;
    console.log(
      `${house?.name ?? householdId}: ${result.linked} compras → ${result.cards} cartão(ões)`,
    );
  }

  console.log(`OK: ${totalLinked} compras amarradas em ${totalCards} cartão(ões).`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
