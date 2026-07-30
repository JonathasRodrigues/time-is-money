import type { CostCentersResponse } from '@tim/api-contract';
import { costCenters } from '@tim/db';
import { eq } from 'drizzle-orm';
import { requireSession } from '@tim/auth';
import type { AppContext } from '../context';

export async function loadCostCenters(ctx: AppContext): Promise<CostCentersResponse> {
  const session = requireSession(ctx.session);
  const db = ctx.db;
  const rows = await ctx.db
    .select()
    .from(costCenters)
    .where(eq(costCenters.householdId, session.householdId));

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      isSystem: row.isSystem,
    })),
  };
}
