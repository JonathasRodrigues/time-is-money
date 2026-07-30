'use client';

import { useUser } from '@clerk/nextjs';
import { isDemoMode, isMockApiMode } from '@tim/mocks';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { isClerkConfigured } from '@/components/auth-shell';
import { IncomePromptHost } from '@/components/income-prompt-host';
import { ScopePreferenceProvider } from '@/components/scope-preference';
import { ThemeSync } from '@/components/theme-sync';
import type { AppTheme } from '@/components/theme-provider';
import { useBootstrap, useMe } from '@/features/session/hooks';

function clerkAccountEnabled(): boolean {
  if (isDemoMode() || isMockApiMode()) return false;
  return isClerkConfigured();
}

function displayNameFromEmail(email: string): string {
  return email.split('@')[0] || 'Usuário';
}

export function AppLayoutClient({ children }: { children: React.ReactNode }): React.ReactElement {
  const offline = isMockApiMode();
  const demo = isDemoMode() || offline;
  return (
    <AppLayoutBody offline={offline} demo={demo} useClerkAccount={clerkAccountEnabled()}>
      {children}
    </AppLayoutBody>
  );
}

function AppLayoutBody({
  children,
  offline,
  demo,
  useClerkAccount,
}: {
  children: React.ReactNode;
  offline: boolean;
  demo: boolean;
  useClerkAccount: boolean;
}): React.ReactElement {
  const { data: me, isPending: mePending } = useMe();
  const { data: bootstrap, isPending: bootstrapPending } = useBootstrap();

  if (mePending || bootstrapPending || !me || !bootstrap) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Carregando…" />
      </div>
    );
  }

  const themePreference: AppTheme = bootstrap.theme;

  const content = (
    <>
      <ThemeSync preference={themePreference} />
      <ScopePreferenceProvider>
        {useClerkAccount ? (
          <ClerkLabeledShell
            meEmail={me.email}
            ttsEnabled={bootstrap.ttsEnabled}
            canManageMembers={me.canManageMembers}
          >
            <IncomePromptHost />
            {children}
          </ClerkLabeledShell>
        ) : (
          <AppShell
            demo={demo}
            userEmail={me.email ?? (demo ? 'voce@demo.local' : 'sem e-mail')}
            userLabel={
              offline
                ? 'Mock UI'
                : demo
                  ? 'Você (Admin)'
                  : displayNameFromEmail(me.email ?? 'usuario')
            }
            ttsEnabled={bootstrap.ttsEnabled}
            canManageMembers={me.canManageMembers}
            useClerkAccount={false}
          >
            <IncomePromptHost />
            {children}
          </AppShell>
        )}
      </ScopePreferenceProvider>
    </>
  );

  return content;
}

/** Só monta com ClerkProvider ativo — usa useUser para nome/e-mail reais. */
function ClerkLabeledShell({
  children,
  meEmail,
  ttsEnabled,
  canManageMembers,
}: {
  children: React.ReactNode;
  meEmail: string | null;
  ttsEnabled: boolean;
  canManageMembers: boolean;
}): React.ReactElement {
  const { user } = useUser();
  const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const clerkName =
    user?.fullName?.trim() || user?.firstName?.trim() || user?.username?.trim() || null;
  const userEmail = meEmail ?? clerkEmail ?? 'sem e-mail';
  const userLabel = clerkName ?? displayNameFromEmail(userEmail);

  return (
    <AppShell
      demo={false}
      userEmail={userEmail}
      userLabel={userLabel}
      ttsEnabled={ttsEnabled}
      canManageMembers={canManageMembers}
      useClerkAccount
    >
      {children}
    </AppShell>
  );
}
