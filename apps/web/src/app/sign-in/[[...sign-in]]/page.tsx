export const dynamic = 'force-dynamic';

import {
  AuthCardHeader,
  AuthFooterNote,
  AuthShell,
  DemoAuthForm,
  shouldUseClerk,
} from '@/components/auth-shell';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}): Promise<React.ReactElement> {
  const params = await searchParams;
  const redirectUrl =
    params.redirect_url && params.redirect_url.startsWith('/') ? params.redirect_url : undefined;

  if (!shouldUseClerk()) {
    return (
      <AuthShell eyebrow="Entrar">
        <DemoAuthForm mode="sign-in" />
        <AuthFooterNote />
      </AuthShell>
    );
  }

  const { SignIn } = await import('@clerk/nextjs');

  return (
    <AuthShell eyebrow="Entrar">
      <AuthCardHeader title="Entrar" description="Acesse o household com sua conta Clerk." />
      <div className="flex justify-center [&_.cl-rootBox]:w-full [&_.cl-card]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border [&_.cl-cardBox]:w-full">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl={
            redirectUrl ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}` : '/sign-up'
          }
          forceRedirectUrl={redirectUrl}
          fallbackRedirectUrl={redirectUrl ?? '/dashboard'}
        />
      </div>
      <AuthFooterNote />
    </AuthShell>
  );
}
