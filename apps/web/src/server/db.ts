import { resolveMfaSatisfied, type AuthSession } from '@tim/auth';
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

  const { auth, clerkClient, currentUser } = await import('@clerk/nextjs/server');
  const session = await auth();
  if (!session.userId) {
    return null;
  }

  // currentUser() pode vir cacheado; Backend API é a fonte de verdade do MFA.
  const client = await clerkClient();
  const backendUser = await client.users.getUser(session.userId);
  const cachedUser = await currentUser();
  const email =
    backendUser.primaryEmailAddress?.emailAddress ??
    cachedUser?.primaryEmailAddress?.emailAddress ??
    null;

  const claims = session.sessionClaims as Record<string, unknown> | null;
  const socialCount =
    (backendUser.externalAccounts?.length ?? 0) || (cachedUser?.externalAccounts?.length ?? 0);
  const mfaEnabled = resolveMfaSatisfied({
    bypass: process.env.DEMO_BYPASS_MFA === '1',
    claimMfa: Boolean(claims?.is_mfa ?? claims?.mfa),
    twoFactorEnabled: Boolean(backendUser.twoFactorEnabled || cachedUser?.twoFactorEnabled),
    totpEnabled: Boolean(backendUser.totpEnabled || cachedUser?.totpEnabled),
    backupCodeEnabled: Boolean(backendUser.backupCodeEnabled || cachedUser?.backupCodeEnabled),
    hasSocialLogin: socialCount > 0,
  });

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
