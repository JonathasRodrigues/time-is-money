import { formatBrlFromCents } from '@tim/domain';
import { sendDueReminderEmail } from '@tim/email';
import {
  financings,
  installments,
  memberships,
  notificationOutbox,
  userPreferences,
} from '@tim/db';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { env } from '@/env';
import { getDb } from '@/server/db';

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: 'Resend not configured' }, { status: 500 });
  }

  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const prefs = await db.select().from(userPreferences);
  const pending = await db.select().from(installments).where(eq(installments.status, 'pending'));
  const fins = await db.select().from(financings);
  const finMap = new Map(fins.map((f) => [f.id, f]));
  const members = await db.select().from(memberships);

  let sent = 0;

  for (const pref of prefs) {
    if (!pref.emailDueReminders) continue;
    const member = members.find(
      (m) => m.userId === pref.userId && m.householdId === pref.householdId,
    );
    if (!member?.email) continue;

    const windows = pref.reminderWindowsDays ?? [7, 3, 1];
    const items = [];

    for (const installment of pending.filter((i) => i.householdId === pref.householdId)) {
      const daysLeft = daysBetween(today, installment.dueOn);
      if (!windows.includes(daysLeft)) continue;

      const already = await db
        .select()
        .from(notificationOutbox)
        .where(
          and(
            eq(notificationOutbox.userId, pref.userId),
            eq(notificationOutbox.kind, 'installment_due'),
            eq(notificationOutbox.referenceId, installment.id),
            eq(notificationOutbox.windowDays, daysLeft),
            eq(notificationOutbox.sentOn, today),
          ),
        )
        .limit(1);
      if (already.length > 0) continue;

      const financing = finMap.get(installment.financingId);
      items.push({
        installmentId: installment.id,
        windowDays: daysLeft,
        name: financing?.name ?? `Parcela #${installment.number}`,
        dueOn: installment.dueOn,
        amountLabel: formatBrlFromCents(installment.amountCents),
        daysLeft,
      });
    }

    if (items.length === 0) continue;

    await sendDueReminderEmail({
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM_EMAIL,
      to: member.email,
      userName: member.email.split('@')[0] ?? 'olá',
      items: items.map(({ name, dueOn, amountLabel, daysLeft }) => ({
        name,
        dueOn,
        amountLabel,
        daysLeft,
      })),
    });

    await db.insert(notificationOutbox).values(
      items.map((item) => ({
        householdId: pref.householdId,
        userId: pref.userId,
        kind: 'installment_due',
        referenceId: item.installmentId,
        windowDays: item.windowDays,
        sentOn: today,
      })),
    );
    sent += items.length;
  }

  return NextResponse.json({ ok: true, sent });
}
