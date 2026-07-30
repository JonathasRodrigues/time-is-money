import {
  DEFAULT_CATEGORY_ALIASES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from '@tim/domain';
import { eq } from 'drizzle-orm';
import type { DbClient } from './index';
import { accounts, categories, categoryAliases, costCenters } from './schema/index';

export async function seedHouseholdDefaults(db: DbClient, householdId: string): Promise<void> {
  const existingCenters = await db
    .select()
    .from(costCenters)
    .where(eq(costCenters.householdId, householdId))
    .limit(1);

  if (existingCenters.length === 0) {
    const [center] = await db
      .insert(costCenters)
      .values({
        householdId,
        name: 'Pessoa Física',
        color: '#1f6f5b',
        isSystem: true,
      })
      .returning();
    if (!center) {
      throw new Error('Failed to seed cost center');
    }

    await db.insert(accounts).values({
      householdId,
      costCenterId: center.id,
      name: 'Carteira / Dinheiro',
      kind: 'cash',
      balanceCents: 0,
      yieldType: 'none',
    });
  }

  const existingCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.householdId, householdId))
    .limit(1);

  if (existingCategories.length > 0) {
    return;
  }

  for (const expense of DEFAULT_EXPENSE_CATEGORIES) {
    const [parent] = await db
      .insert(categories)
      .values({
        householdId,
        name: expense.name,
        type: 'expense',
        isSystem: true,
      })
      .returning();
    if (!parent) continue;

    for (const childName of expense.children ?? []) {
      const [child] = await db
        .insert(categories)
        .values({
          householdId,
          parentId: parent.id,
          name: childName,
          type: 'expense',
          isSystem: true,
        })
        .returning();
      if (!child) continue;

      const aliases = DEFAULT_CATEGORY_ALIASES[childName] ?? [];
      if (aliases.length > 0) {
        await db.insert(categoryAliases).values(
          aliases.map((alias) => ({
            householdId,
            categoryId: child.id,
            alias,
          })),
        );
      }
    }

    const parentAliases = DEFAULT_CATEGORY_ALIASES[expense.name] ?? [];
    if (parentAliases.length > 0) {
      await db.insert(categoryAliases).values(
        parentAliases.map((alias) => ({
          householdId,
          categoryId: parent.id,
          alias,
        })),
      );
    }
  }

  for (const incomeName of DEFAULT_INCOME_CATEGORIES) {
    await db.insert(categories).values({
      householdId,
      name: incomeName,
      type: 'income',
      isSystem: true,
    });
  }
}
