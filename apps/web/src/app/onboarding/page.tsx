import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/components/onboarding-form';
import { getAuthSession } from '@/server/db';

export default async function OnboardingPage(): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session) redirect('/sign-in');
  if (session.householdId) redirect('/dashboard');

  return <OnboardingForm />;
}
