export const dynamic = 'force-dynamic';

import {
  AuthCardHeader,
  AuthFooterNote,
  AuthShell,
  DemoAuthForm,
  isClerkConfigured,
} from '@/components/auth-shell';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const redirectUrl =
    params.redirect_url && params.redirect_url.startsWith('/') ? params.redirect_url : undefined;

  if (!isClerkConfigured()) {
    return (
      <AuthShell eyebrow="Cadastro">
        <DemoAuthForm mode="sign-up" />
        <AuthFooterNote />
      </AuthShell>
    );
  }

  const { SignUp } = await import('@clerk/nextjs');

  return (
    <AuthShell eyebrow="Cadastro">
      <AuthCardHeader
        title="Criar conta"
        description="Crie sua conta e depois configure o household."
      />
      <div className="flex justify-center [&_.cl-rootBox]:w-full [&_.cl-card]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border [&_.cl-cardBox]:w-full">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl={
            redirectUrl ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}` : '/sign-in'
          }
          forceRedirectUrl={redirectUrl}
          fallbackRedirectUrl={redirectUrl ?? '/onboarding'}
        />
      </div>
      <AuthFooterNote />
    </AuthShell>
  );
}
