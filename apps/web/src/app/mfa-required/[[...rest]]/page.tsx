export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isClerkConfigured } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { getAuthSession } from '@/server/db';

export default async function MfaRequiredPage(): Promise<React.ReactElement> {
  const configured = isClerkConfigured();
  const session = await getAuthSession();

  if (session?.mfaEnabled) {
    redirect(session.householdId ? '/dashboard' : '/onboarding');
  }

  if (!configured) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold">MFA obrigatório</h1>
        <p className="text-sm text-muted-foreground">Clerk não configurado neste ambiente.</p>
        <Button asChild>
          <Link href="/dashboard">Continuar na demo</Link>
        </Button>
      </main>
    );
  }

  const { SignOutButton, UserProfile } = await import('@clerk/nextjs');

  return (
    <main className="min-h-svh bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="space-y-2">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            ← Time is Money
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">MFA obrigatório</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Clique em Security no menu à esquerda e ative Authenticator application. Se a seção não
            aparecer, no Clerk Dashboard ative Multi-factor → Authenticator application (instância
            Development).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="default">
            <Link href="/mfa-required#/security">Ir para Security</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Já ativei — tentar novamente</Link>
          </Button>
          <SignOutButton redirectUrl="/sign-in">
            <Button variant="ghost" type="button">
              Sair e entrar de novo
            </Button>
          </SignOutButton>
        </div>

        {/* max-w-md do AuthShell esmagava o UserProfile — precisa de largura cheia */}
        <div className="w-full rounded-xl border bg-card p-1 sm:p-2 [&_.cl-rootBox]:mx-auto [&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full [&_.cl-scrollBox]:max-h-none">
          <UserProfile routing="hash" />
        </div>
      </div>
    </main>
  );
}
