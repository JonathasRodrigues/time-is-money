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
import { jarvisMessageSchema } from '@tim/validators';
import { and, eq } from 'drizzle-orm';
import type { AppContext } from '../context.js';

async function runCreateTransaction(
  ctx: AppContext,
  input: Parameters<typeof import('../index.js').createTransaction>[1],
  source: Parameters<typeof import('../index.js').createTransaction>[2],
): Promise<void> {
  const { createTransaction } = await import('../index.js');
  await createTransaction(ctx, input, source);
}

export type JarvisMessageResult = {
  reply: string;
  threadId: string;
  options?: Array<{ id: string; label: string }>;
  intent: JarvisIntent;
};

export async function sendJarvisMessage(
  ctx: AppContext,
  raw: { content: string; source: 'text' | 'voice'; threadId?: string },
): Promise<JarvisMessageResult> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'jarvis.chat');
  const input = jarvisMessageSchema.parse(raw);

  let threadId = input.threadId;
  if (!threadId) {
    const [thread] = await ctx.db
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

  await ctx.db.insert(jarvisMessages).values({
    threadId,
    householdId: session.householdId,
    role: 'user',
    source: input.source,
    content: input.content,
  });

  const [centers, cats, aliases, accs, prefs] = await Promise.all([
    ctx.db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    ctx.db.select().from(categories).where(eq(categories.householdId, session.householdId)),
    ctx.db
      .select()
      .from(categoryAliases)
      .where(eq(categoryAliases.householdId, session.householdId)),
    ctx.db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
    ctx.db
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
    await runCreateTransaction(
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

  await ctx.db.insert(jarvisMessages).values({
    threadId,
    householdId: session.householdId,
    role: 'assistant',
    source: 'text',
    content: reply,
    intent,
  });

  return { reply, threadId, options, intent };
}
