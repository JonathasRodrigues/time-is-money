export const dynamic = 'force-dynamic';

import { listPendingInvitesForEmail } from '@tim/application';
import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/components/onboarding-form';
import { getAuthSession, getDb } from '@/server/db';

export default async function OnboardingPage(): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session) redirect('/sign-in');
  if (session.householdId) redirect('/dashboard');

  const pendingInvites = await listPendingInvitesForEmail(getDb(), session.email);

  return (
    <OnboardingForm
      pendingInvites={pendingInvites.map((invite) => ({
        id: invite.id,
        householdName: invite.householdName,
        role: invite.role,
      }))}
    />
  );
}
