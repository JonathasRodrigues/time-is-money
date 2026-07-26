import type { Capability, Role } from '@tim/permissions';
import { assertCapability, hasCapability } from '@tim/permissions';

export interface AuthSession {
  userId: string;
  email: string | null;
  householdId: string;
  role: Role;
  mfaEnabled: boolean;
}

/** Fatos de MFA vindos do Clerk (sem depender do SDK no domain). */
export interface ClerkMfaFacts {
  bypass?: boolean;
  claimMfa?: boolean;
  twoFactorEnabled?: boolean;
  totpEnabled?: boolean;
  backupCodeEnabled?: boolean;
  /** Conta com OAuth social verificado (Google, etc.) — satisfaz o gate do app. */
  hasSocialLogin?: boolean;
}

/**
 * Login social já autentica via provedor externo; MFA TOTP do Clerk
 * (plano Pro) não é exigido nesses casos.
 */
export function resolveMfaSatisfied(facts: ClerkMfaFacts): boolean {
  if (facts.bypass) return true;
  if (facts.claimMfa) return true;
  if (facts.twoFactorEnabled || facts.totpEnabled || facts.backupCodeEnabled) return true;
  if (facts.hasSocialLogin) return true;
  return false;
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
