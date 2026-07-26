import type { AuthSession } from '@tim/auth';
import { createDb, memberships, type Database } from '@tim/db';
import { DEMO, getDemoSession, isDemoMode } from '@tim/mocks';
import type { Role } from '@tim/permissions';
import { eq } from 'drizzle-orm';
import { env } from '@/env';

const globalForAppDb = globalThis as typeof globalThis & {
  __timAppDb?: Database;
};

export function getDb(): Database {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada');
  }
  if (!globalForAppDb.__timAppDb) {
    globalForAppDb.__timAppDb = createDb(env.DATABASE_URL);
  }
  return globalForAppDb.__timAppDb;
}

export function getEncryptionSecret(): string {
  if (!env.ENCRYPTION_SECRET) {
    throw new Error('ENCRYPTION_SECRET não configurada');
  }
  return env.ENCRYPTION_SECRET;
}

export async function getAuthSession(): Promise<AuthSession | null> {
  if (isDemoMode()) {
    if (!env.DATABASE_URL) {
      return getDemoSession('');
    }
    const db = getDb();
    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, DEMO.userId))
      .limit(1);

    if (!membership) {
      return getDemoSession('');
    }
    return getDemoSession(membership.householdId);
  }

  const { auth, currentUser } = await import('@clerk/nextjs/server');
  const session = await auth();
  if (!session.userId) {
    return null;
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  // MFA do Clerk é Pro — não bloqueamos no Hobby. Campo preservado como true.
  const mfaEnabled = true;

  if (!env.DATABASE_URL) {
    return {
      userId: session.userId,
      email,
      householdId: '',
      role: 'admin',
      mfaEnabled,
    };
  }

  const db = getDb();
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.userId))
    .limit(1);

  if (!membership) {
    return {
      userId: session.userId,
      email,
      householdId: '',
      role: 'admin',
      mfaEnabled,
    };
  }

  return {
    userId: session.userId,
    email,
    householdId: membership.householdId,
    role: membership.role as Role,
    mfaEnabled,
  };
}
