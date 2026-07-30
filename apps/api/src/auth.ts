import { createClerkClient, verifyToken } from '@clerk/backend';
import type { AuthSession } from '@tim/auth';
import { memberships } from '@tim/db';
import { DEMO, getDemoSession } from '@tim/mocks';
import type { Role } from '@tim/permissions';
import { eq } from 'drizzle-orm';
import { env, isDemoMode } from './env.js';
import { getDb } from './db.js';

function clerkPublishableKey(): string | undefined {
  const key = env.CLERK_PUBLISHABLE_KEY;
  if (key && key.startsWith('pk_') && !key.includes('placeholder')) {
    return key;
  }
  return undefined;
}

async function membershipSession(
  userId: string,
  email: string | null,
): Promise<AuthSession | null> {
  if (!env.DATABASE_URL) {
    return {
      userId,
      email,
      householdId: '',
      role: 'admin',
      mfaEnabled: true,
    };
  }

  const db = getDb();
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  if (!membership) {
    return {
      userId,
      email,
      householdId: '',
      role: 'admin',
      mfaEnabled: true,
    };
  }

  return {
    userId,
    email,
    householdId: membership.householdId,
    role: membership.role as Role,
    mfaEnabled: true,
  };
}

async function demoSession(): Promise<AuthSession | null> {
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

/** Clerk só precisa de URL/headers/cookies — não pode consumir o body (Hono/Next no Node). */
function requestForClerkAuth(request: Request): Request {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
  });
}

/** Resolves session from Bearer JWT or Clerk cookie (web proxy). */
export async function getAuthSession(request: Request): Promise<AuthSession | null> {
  if (isDemoMode()) {
    return demoSession();
  }

  const publishableKey = clerkPublishableKey();
  const secretKey = env.CLERK_SECRET_KEY;
  if (!secretKey || !publishableKey) {
    return null;
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    try {
      const payload = await verifyToken(token, { secretKey });
      const userId = payload.sub;
      if (!userId) return null;
      const email =
        typeof payload.email === 'string'
          ? payload.email
          : typeof payload.primary_email_address === 'string'
            ? payload.primary_email_address
            : null;
      return membershipSession(userId, email);
    } catch {
      return null;
    }
  }

  const clerk = createClerkClient({ secretKey });
  const requestState = await clerk.authenticateRequest(requestForClerkAuth(request), {
    publishableKey,
    authorizedParties: env.APP_BASE_URL ? [env.APP_BASE_URL.replace(/\/$/, '')] : undefined,
  });

  if (!requestState.isSignedIn) {
    return null;
  }

  const auth = requestState.toAuth();
  const userId = auth.userId;
  if (!userId) return null;

  const email =
    auth.sessionClaims?.email && typeof auth.sessionClaims.email === 'string'
      ? auth.sessionClaims.email
      : null;

  return membershipSession(userId, email);
}
