'use server';

import { createTransaction } from '@tim/application';
import { requireCapability, requireSession } from '@tim/auth';
import {
  accounts,
  categories,
  categoryAliases,
  costCenters,
  jarvisMessages,
  jarvisThreads,
  userPreferences,
} from '@tim/db';
import { parseJarvisUtterance, resolveIntentAgainstContext, type JarvisIntent } from '@tim/jarvis';
import { and, eq } from 'drizzle-orm';
import { createAppContext } from '@/server/context';
import { getDb } from '@/server/db';

export async function sendJarvisMessageAction(input: {
  content: string;
  source: 'text' | 'voice';
  threadId?: string;
}): Promise<{
  reply: string;
  threadId: string;
  options?: Array<{ id: string; label: string }>;
  intent: JarvisIntent;
}> {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  requireCapability(session, 'jarvis.chat');
  const db = getDb();

  let threadId = input.threadId;
  if (!threadId) {
    const [thread] = await db
      .insert(jarvisThreads)
      .values({
        householdId: session.householdId,
        userId: session.userId,
        title: input.content.slice(0, 80),
      })
      .returning();
    threadId = thread?.id;
  }
  if (!threadId) throw new Error('Falha ao criar thread');

  await db.insert(jarvisMessages).values({
    threadId,
    householdId: session.householdId,
    role: 'user',
    source: input.source,
    content: input.content,
  });

  const [centers, cats, aliases, accs, prefs] = await Promise.all([
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(categories).where(eq(categories.householdId, session.householdId)),
    db.select().from(categoryAliases).where(eq(categoryAliases.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
    db
      .select()
      .from(userPreferences)
      .where(
        and(
          eq(userPreferences.householdId, session.householdId),
          eq(userPreferences.userId, session.userId),
        ),
      )
      .limit(1),
  ]);

  const aliasByCategory = aliases.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.categoryId] = [...(acc[row.categoryId] ?? []), row.alias];
    return acc;
  }, {});

  const context = {
    costCenters: centers.map((c) => ({ id: c.id, name: c.name })),
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      aliases: aliasByCategory[c.id] ?? [],
    })),
    accounts: accs.map((a) => ({
      id: a.id,
      name: a.name,
      costCenterId: a.costCenterId,
    })),
  };

  const intent = parseJarvisUtterance(input.content);
  const resolved = resolveIntentAgainstContext(intent, context, {
    costCenterId: prefs[0]?.defaultCostCenterId ?? centers[0]?.id,
    accountId: prefs[0]?.defaultAccountId ?? accs[0]?.id,
  });

  const reply = resolved.reply;
  const options = resolved.clarification?.options;

  if (
    resolved.ready &&
    (intent.type === 'create_expense' || intent.type === 'create_income') &&
    resolved.costCenterId &&
    resolved.categoryId &&
    resolved.accountId
  ) {
    requireCapability(session, 'jarvis.mutate');
    const today = new Date().toISOString().slice(0, 10);
    await createTransaction(
      ctx,
      {
        householdId: session.householdId,
        costCenterId: resolved.costCenterId,
        categoryId: resolved.categoryId,
        accountId: resolved.accountId,
        type: intent.type === 'create_expense' ? 'expense' : 'income',
        amountCents: intent.amountCents,
        occurredOn: intent.occurredOn ?? today,
        description: intent.description ?? input.content,
      },
      'jarvis',
    );
  }

  await db.insert(jarvisMessages).values({
    threadId,
    householdId: session.householdId,
    role: 'assistant',
    source: 'text',
    content: reply,
    intent,
  });

  return { reply, threadId, options, intent };
}
