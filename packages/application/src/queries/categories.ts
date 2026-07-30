import type { CategoriesResponse } from '@tim/api-contract';
import { categories } from '@tim/db';
import { eq } from 'drizzle-orm';
import { requireSession } from '@tim/auth';
import type { AppContext } from '../context';

export async function loadCategories(ctx: AppContext): Promise<CategoriesResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
  const rows = await ctx.db
    .select()
    .from(categories)
    .where(eq(categories.householdId, session.householdId));

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      isSystem: row.isSystem,
    })),
  };
}
