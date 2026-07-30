'use client';

import { isDemoMode, isMockApiMode } from '@tim/mocks';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { IncomePromptHost } from '@/components/income-prompt-host';
import { ScopePreferenceProvider } from '@/components/scope-preference';
import { ThemeSync } from '@/components/theme-sync';
import type { AppTheme } from '@/components/theme-provider';
import { useBootstrap, useMe } from '@/features/session/hooks';

export function AppLayoutClient({ children }: { children: React.ReactNode }): React.ReactElement {
  const offline = isMockApiMode();
  const demo = isDemoMode() || offline;
  const { data: me, isPending: mePending } = useMe();
  const { data: bootstrap, isPending: bootstrapPending } = useBootstrap();

  if (mePending || bootstrapPending || !me || !bootstrap) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Carregando…" />
      </div>
    );
  }

  const userEmail = me.email ?? (demo ? 'voce@demo.local' : 'usuario');
  const userLabel = offline
    ? 'Mock UI'
    : demo
      ? 'Você (Admin)'
      : (userEmail.split('@')[0] ?? 'Usuário');
  const themePreference: AppTheme = bootstrap.theme;

  return (
    <>
      <ThemeSync preference={themePreference} />
      <ScopePreferenceProvider>
        <AppShell
          demo={demo}
          userEmail={userEmail}
          userLabel={userLabel}
          ttsEnabled={bootstrap.ttsEnabled}
          canManageMembers={me.canManageMembers}
        >
          <IncomePromptHost />
          {children}
        </AppShell>
      </ScopePreferenceProvider>
    </>
  );
}
