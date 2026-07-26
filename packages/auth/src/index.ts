import type { Capability, Role } from '@tim/permissions';
import { assertCapability, hasCapability } from '@tim/permissions';

export interface AuthSession {
  userId: string;
  email: string | null;
  householdId: string;
  role: Role;
  mfaEnabled: boolean;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: 'UNAUTHENTICATED' | 'MFA_REQUIRED' | 'FORBIDDEN' | 'NO_HOUSEHOLD',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function requireSession(session: AuthSession | null): AuthSession {
  if (!session) {
    throw new AuthError('Não autenticado', 'UNAUTHENTICATED');
  }
  if (!session.mfaEnabled) {
    throw new AuthError('MFA obrigatório', 'MFA_REQUIRED');
  }
  if (!session.householdId) {
    throw new AuthError('Household não configurado', 'NO_HOUSEHOLD');
  }
  return session;
}

export function requireCapability(session: AuthSession, capability: Capability): void {
  try {
    assertCapability(session.role, capability);
  } catch {
    throw new AuthError(`Sem permissão: ${capability}`, 'FORBIDDEN');
  }
}

export function can(session: AuthSession, capability: Capability): boolean {
  return hasCapability(session.role, capability);
}
