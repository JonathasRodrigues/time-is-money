export const dynamic = 'force-dynamic';

import {
  AuthCardHeader,
  AuthFooterNote,
  AuthShell,
  DemoAuthForm,
  isClerkConfigured,
} from '@/components/auth-shell';

export default async function SignUpPage(): Promise<React.ReactElement> {
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
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </div>
      <AuthFooterNote />
    </AuthShell>
  );
}
