import Link from 'next/link';
import { isDemoMode } from '@tim/mocks';
import { Button } from '@/components/ui/button';
import { shouldUseClerk } from '@/components/auth-shell';

export default async function HomePage(): Promise<React.ReactElement> {
  const demo = isDemoMode();
  const useClerk = shouldUseClerk();
  const clerk = useClerk ? await import('@clerk/nextjs') : null;

  return (
    <main className="min-h-screen">
      <div
        className="relative min-h-[100svh] overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, #0f1c2e 0%, #1a3a45 48%, #155e4f 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 18%, #ffffff33 0, transparent 36%), radial-gradient(circle at 82% 8%, #2f5d8a44 0, transparent 32%)',
          }}
        />
        <header className="relative z-10 flex items-center justify-between px-6 py-5 text-[#eef2f6]">
          <p className="text-2xl font-semibold tracking-tight">Time is Money</p>
          <div className="flex items-center gap-3">
            {clerk ? (
              <>
                <clerk.SignedOut>
                  <Link href="/sign-in">
                    <Button variant="secondary">Entrar</Button>
                  </Link>
                </clerk.SignedOut>
                <clerk.SignedIn>
                  <Link href="/dashboard">
                    <Button variant="secondary">Abrir app</Button>
                  </Link>
                  <clerk.UserButton />
                </clerk.SignedIn>
              </>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="secondary">Entrar</Button>
                </Link>
                {demo ? (
                  <Link href="/dashboard">
                    <Button className="bg-white text-[#0f1c2e] hover:bg-white/90">
                      Abrir demo
                    </Button>
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </header>
        <section className="relative z-10 mx-auto flex max-w-3xl flex-col gap-6 px-6 pb-24 pt-20 text-[#eef2f6]">
          <h1 className="text-5xl leading-tight md:text-6xl">
            Controle financeiro da casa, com clareza e segurança.
          </h1>
          <p className="max-w-xl text-lg text-[#c5ced9]">
            Centros de custo, financiamentos, dashboards e Jarvis — você e sua família no mesmo
            household, com papéis e MFA.
          </p>
          <div className="flex flex-wrap gap-3">
            {clerk ? (
              <>
                <clerk.SignedOut>
                  <Link href="/sign-in">
                    <Button size="lg" className="bg-white text-[#0f1c2e] hover:bg-white/90">
                      Começar
                    </Button>
                  </Link>
                  <Link href="/sign-up">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white/30 bg-transparent text-white hover:bg-white/10"
                    >
                      Criar conta
                    </Button>
                  </Link>
                </clerk.SignedOut>
                <clerk.SignedIn>
                  <Link href="/dashboard">
                    <Button size="lg" className="bg-white text-[#0f1c2e] hover:bg-white/90">
                      Ir ao dashboard
                    </Button>
                  </Link>
                </clerk.SignedIn>
              </>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button size="lg" className="bg-white text-[#0f1c2e] hover:bg-white/90">
                    Ver login
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 bg-transparent text-white hover:bg-white/10"
                  >
                    Ver cadastro
                  </Button>
                </Link>
                {demo ? (
                  <Link href="/dashboard">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white/30 bg-transparent text-white hover:bg-white/10"
                    >
                      Abrir demo
                    </Button>
                  </Link>
                ) : null}
              </>
            )}
          </div>
          {demo ? (
            <p className="text-sm text-[#9aa6b5]">
              Modo demo ativo — a home e as telas de acesso ficam abertas para revisar o visual. O
              app continua em{' '}
              <Link href="/dashboard" className="underline underline-offset-2">
                /dashboard
              </Link>
              .
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
