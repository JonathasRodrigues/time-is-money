export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCardHeader, AuthShell, isClerkConfigured } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { getAuthSession } from '@/server/db';

export default async function MfaRequiredPage(): Promise<React.ReactElement> {
  const configured = isClerkConfigured();
  const session = await getAuthSession();

  if (session?.mfaEnabled) {
    redirect(session.householdId ? '/dashboard' : '/onboarding');
  }

  const UserProfile = configured ? (await import('@clerk/nextjs')).UserProfile : null;

  return (
    <AuthShell eyebrow="Segurança">
      <AuthCardHeader
        title="MFA obrigatório"
        description="No painel abaixo, abra Security → Authenticator application e ative o app authenticator na conta deste app (não no login do dashboard.clerk.com)."
      />
      <p className="text-sm text-muted-foreground">
        Depois de ativar:{' '}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          saia e entre de novo
        </Link>{' '}
        (o Clerk só passa a exigir o 2º fator no próximo login), depois clique em “Já ativei”.
      </p>
      {UserProfile ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <UserProfile routing="path" path="/mfa-required" />
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>Preview: em produção o perfil Clerk aparece aqui para ativar o MFA.</p>
          <Button asChild>
            <Link href="/dashboard">Continuar na demo</Link>
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/mfa-required/security" className="font-medium text-primary hover:underline">
          Abrir Security
        </Link>
        <Link href="/dashboard" className="font-medium text-primary hover:underline">
          Já ativei — tentar novamente
        </Link>
      </div>
    </AuthShell>
  );
}
