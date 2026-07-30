export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { isDemoMode, isMockApiMode } from '@tim/mocks';
import { AppLayoutClient } from '@/components/app-layout-client';
import { shouldUseClerk } from '@/components/auth-shell';
import { getAuthSession } from '@/server/db';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const mockApi = isMockApiMode();
  const demo = isDemoMode();
  const useClerk = shouldUseClerk();
  const session = await getAuthSession();

  if (!mockApi && !demo) {
    if (useClerk && !session) {
      redirect('/sign-in');
    }
  } else if (demo && !mockApi && !session?.householdId) {
    redirect('/onboarding');
  }

  return <AppLayoutClient>{children}</AppLayoutClient>;
}
