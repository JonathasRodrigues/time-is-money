export const dynamic = 'force-dynamic';

import {
  AuthCardHeader,
  AuthFooterNote,
  AuthShell,
  DemoAuthForm,
  isClerkConfigured,
} from '@/components/auth-shell';

export default async function SignInPage(): Promise<React.ReactElement> {
  if (!isClerkConfigured()) {
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
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </div>
      <AuthFooterNote />
    </AuthShell>
  );
}
