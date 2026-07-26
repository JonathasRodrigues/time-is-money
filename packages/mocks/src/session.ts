import type { AuthSession } from '@tim/auth';

/** IDs estáveis para modo demo local — não usar em produção. */
export const DEMO = {
  userId: 'demo_user_admin',
  spouseUserId: 'demo_user_spouse',
  email: 'voce@demo.local',
  spouseEmail: 'esposa@demo.local',
  householdName: 'Casa Demo',
} as const;

export function getDemoSession(householdId: string): AuthSession {
  return {
    userId: DEMO.userId,
    email: DEMO.email,
    householdId,
    role: 'admin',
    mfaEnabled: true,
  };
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true';
}
