export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getAuthSession } from '@/server/db';

/** Rota legada — MFA não é mais exigido (Clerk MFA = plano Pro). */
export default async function MfaRequiredPage(): Promise<never> {
  const session = await getAuthSession();
  redirect(session?.householdId ? '/dashboard' : '/onboarding');
}
