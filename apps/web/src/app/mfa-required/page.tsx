export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { AuthCardHeader, AuthShell, isClerkConfigured } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';

export default async function MfaRequiredPage(): Promise<React.ReactElement> {
  const configured = isClerkConfigured();
  const UserProfile = configured ? (await import('@clerk/nextjs')).UserProfile : null;

  return (
    <AuthShell eyebrow="Segurança">
      <AuthCardHeader
        title="MFA obrigatório"
        description="Ative a autenticação em dois fatores (app authenticator) na sua conta Clerk para continuar."
      />
      {UserProfile ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <UserProfile />
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>Preview: em produção o perfil Clerk aparece aqui para ativar o MFA.</p>
          <Button asChild>
            <Link href="/dashboard">Continuar na demo</Link>
          </Button>
        </div>
      )}
      <Link
        href="/dashboard"
        className="inline-block text-sm font-medium text-primary hover:underline"
      >
        Já ativei — tentar novamente
      </Link>
    </AuthShell>
  );
}
