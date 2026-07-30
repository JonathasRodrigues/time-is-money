import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { isDemoMode, isMockApiMode } from '@tim/mocks';

/** Chaves Clerk presentes (podem existir mesmo em demo). */
export function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith('pk_') && !key.includes('placeholder'));
}

/**
 * Se o app deve montar Clerk (Provider, SignIn, middleware protect).
 * Em DEMO_MODE o mock manda — ignora chaves Clerk quebradas/ausentes.
 */
export function shouldUseClerk(): boolean {
  if (isDemoMode() || isMockApiMode()) return false;
  return isClerkConfigured();
}

export function AuthShell({
  children,
  eyebrow = 'Acesso',
}: {
  children: React.ReactNode;
  eyebrow?: string;
}): React.ReactElement {
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
      <aside
        className="relative hidden overflow-hidden px-10 py-10 text-[#eef2f6] lg:flex lg:flex-col lg:justify-between"
        style={{
          background: 'linear-gradient(155deg, #0f1c2e 0%, #1a3a45 48%, #155e4f 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #ffffff33 0, transparent 38%), radial-gradient(circle at 85% 12%, #2f5d8a55 0, transparent 34%)',
          }}
        />
        <div className="relative z-10">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#c5ced9]">
            {eyebrow}
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight">Time is Money</p>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[#c5ced9]">
            Finanças da casa com centros de custo, financiamentos e o Jarvis — no mesmo household,
            com papéis claros.
          </p>
        </div>
        <p className="relative z-10 text-sm text-[#9aa6b5]">
          Você + família · dados privados · MFA quando for produção
        </p>
      </aside>

      <section className="flex items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}

export function AuthCardHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <div className="mb-8 space-y-2">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Time is Money
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function DemoAuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }): React.ReactElement {
  const isSignIn = mode === 'sign-in';

  return (
    <div className="space-y-6">
      <AuthCardHeader
        title={isSignIn ? 'Entrar' : 'Criar conta'}
        description={
          isSignIn
            ? 'Preview da tela de login. Em produção isso usa Clerk + MFA.'
            : 'Preview do cadastro. Em produção o Clerk cria a conta e o MFA.'
        }
      />

      <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Demo local ativa · Clerk desligado. Os campos abaixo são só visual — use o botão para abrir
        o app.
      </div>

      <div className="space-y-4">
        {!isSignIn ? (
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              defaultValue="Você"
              autoComplete="name"
              readOnly
              className="bg-card"
            />
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue="voce@demo.local"
            autoComplete="email"
            readOnly
            className="bg-card"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            defaultValue="••••••••"
            autoComplete={isSignIn ? 'current-password' : 'new-password'}
            readOnly
            className="bg-card"
          />
        </div>
        <Button asChild className="w-full" size="lg">
          <Link href="/dashboard">{isSignIn ? 'Entrar na demo' : 'Criar conta na demo'}</Link>
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {isSignIn ? (
          <>
            Não tem conta?{' '}
            <Link href="/sign-up" className="font-medium text-primary hover:underline">
              Criar conta
            </Link>
          </>
        ) : (
          <>
            Já tem conta?{' '}
            <Link href="/sign-in" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export function AuthFooterNote({ className }: { className?: string }): React.ReactElement {
  return (
    <p className={cn('pt-2 text-center text-xs text-muted-foreground', className)}>
      Ao continuar, você concorda em usar o app só no seu household.
    </p>
  );
}
