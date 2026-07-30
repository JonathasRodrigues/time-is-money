import type { AuthSession } from '@tim/auth';
import { AuthError, requireCapability } from '@tim/auth';
import type { ZodSchema } from 'zod';
import { ApiHttpError, parseWithSchema } from '../http.js';

export async function parseJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim().length === 0) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiHttpError('VALIDATION', 'JSON inválido');
  }
}

export function guardCapability(
  session: AuthSession,
  capability: Parameters<typeof requireCapability>[1],
): void {
  try {
    requireCapability(session, capability);
  } catch (err) {
    if (err instanceof AuthError) {
      throw new ApiHttpError('FORBIDDEN', err.message);
    }
    throw new ApiHttpError('FORBIDDEN', `Sem permissão: ${capability}`);
  }
}

export function parseBody<T>(schema: ZodSchema<T>, raw: unknown): T {
  return parseWithSchema(schema, raw);
}

/** Merges session household into API body and validates with the full @tim/validators schema. */
export function householdInput<T>(session: AuthSession, schema: ZodSchema<T>, partial: unknown): T {
  const record =
    partial !== null && typeof partial === 'object' ? (partial as Record<string, unknown>) : {};
  return parseWithSchema(schema, { householdId: session.householdId, ...record });
}

export function withHouseholdId<T extends Record<string, unknown>>(
  session: AuthSession,
  body: T,
): T & { householdId: string } {
  return { ...body, householdId: session.householdId };
}
