import { households, memberships, seedHouseholdDefaults, userPreferences } from '@tim/db';
import type { AppContext } from '../context.js';

export async function createHousehold(
  ctx: AppContext,
  input: { userId: string; email: string | null; name: string },
): Promise<{ householdId: string }> {
  return ctx.db.transaction(async (tx) => {
    const [household] = await tx
      .insert(households)
      .values({ name: input.name.trim() || 'Minha casa' })
      .returning();
    if (!household) {
      throw new Error('Falha ao criar household');
    }

    await tx.insert(memberships).values({
      householdId: household.id,
      userId: input.userId,
      email: input.email,
      role: 'admin',
    });

    await seedHouseholdDefaults(tx as AppContext['db'], household.id);

    await tx.insert(userPreferences).values({
      householdId: household.id,
      userId: input.userId,
    });

    return { householdId: household.id };
  });
}
