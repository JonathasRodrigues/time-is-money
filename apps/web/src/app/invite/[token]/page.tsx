export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { peekHouseholdInvite } from '@tim/application';
import { MEMBER_ROLE_LABEL } from '@tim/domain';
import { AuthCardHeader, AuthShell, isClerkConfigured } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { AcceptInviteForm } from '@/components/accept-invite-form';
import { getAuthSession, getDb } from '@/server/db';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token } = await params;
  const session = await getAuthSession();

  let peek: Awaited<ReturnType<typeof peekHouseholdInvite>> = null;
  try {
    peek = await peekHouseholdInvite(getDb(), token);
  } catch {
    peek = null;
  }

  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`;
  const signUpHref = `/sign-up?redirect_url=${encodeURIComponent(`/invite/${token}`)}`;

  if (!peek) {
    return (
      <AuthShell eyebrow="Convite">
        <AuthCardHeader
          title="Convite inválido"
          description="Este link não existe ou está malformado."
        />
        <Button asChild>
          <Link href="/">Ir para o início</Link>
        </Button>
      </AuthShell>
    );
  }

  if (peek.status === 'expired') {
    return (
      <AuthShell eyebrow="Convite">
        <AuthCardHeader
          title="Convite expirado"
          description={`O convite para ${peek.householdName} expirou. Peça um novo ao admin.`}
        />
        <Button asChild>
          <Link href="/">Ir para o início</Link>
        </Button>
      </AuthShell>
    );
  }

  if (peek.status === 'revoked') {
    return (
      <AuthShell eyebrow="Convite">
        <AuthCardHeader
          title="Convite cancelado"
          description={`O convite para ${peek.householdName} foi cancelado.`}
        />
        <Button asChild>
          <Link href="/">Ir para o início</Link>
        </Button>
      </AuthShell>
    );
  }

  if (peek.status === 'accepted') {
    return (
      <AuthShell eyebrow="Convite">
        <AuthCardHeader
          title="Convite já usado"
          description="Este convite já foi aceito. Entre na sua conta para acessar o household."
        />
        <Button asChild>
          <Link href="/sign-in">Entrar</Link>
        </Button>
      </AuthShell>
    );
  }

  if (!session) {
    return (
      <AuthShell eyebrow="Convite">
        <AuthCardHeader
          title={`Entrar em ${peek.householdName}`}
          description={`Você foi convidado como ${MEMBER_ROLE_LABEL[peek.role]}. Use o e-mail ${peek.email} para continuar.`}
        />
        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link href={signInHref}>Entrar e aceitar</Link>
          </Button>
          {isClerkConfigured() ? (
            <Button asChild variant="outline">
              <Link href={signUpHref}>Criar conta</Link>
            </Button>
          ) : null}
        </div>
      </AuthShell>
    );
  }

  if (session.householdId) {
    return (
      <AuthShell eyebrow="Convite">
        <AuthCardHeader
          title="Você já tem um household"
          description="Cada conta entra em um household por vez. Saia do atual ou use outra conta para aceitar."
        />
        <Button asChild>
          <Link href="/dashboard">Ir ao dashboard</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Convite">
      <AuthCardHeader
        title={`Entrar em ${peek.householdName}`}
        description={`Papel: ${MEMBER_ROLE_LABEL[peek.role]}. Conta: ${session.email ?? 'sem e-mail'}.`}
      />
      <AcceptInviteForm token={token} expectedEmail={peek.email} />
    </AuthShell>
  );
}
