import { requireSession } from '@tim/auth';
import { households, memberships, seedHouseholdDefaults, userPreferences } from '@tim/db';
import type { AppContext } from '../context.js';

export async function createHousehold(
  ctx: AppContext,
  input: { userId: string; email: string | null; name: string },
): Promise<{ householdId: string }> {
  const [household] = await ctx.db
    .insert(households)
    .values({ name: input.name.trim() || 'Minha casa' })
    .returning();
  if (!household) {
    throw new Error('Falha ao criar household');
  }

  await ctx.db.insert(memberships).values({
    householdId: household.id,
    userId: input.userId,
    email: input.email,
    role: 'admin',
  });

  await seedHouseholdDefaults(ctx.db, household.id);

  await ctx.db.insert(userPreferences).values({
    householdId: household.id,
    userId: input.userId,
  });

  return { householdId: household.id };
}
