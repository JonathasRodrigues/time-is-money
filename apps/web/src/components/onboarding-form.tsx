'use client';

import { useTransition } from 'react';
import type { Role } from '@tim/permissions';
import { MEMBER_ROLE_LABEL } from '@tim/domain';
import { createHouseholdAction } from '@/server/actions';
import { acceptInviteByIdAction } from '@/server/members-actions';
import { AuthCardHeader, AuthFooterNote, AuthShell } from '@/components/auth-shell';
import { ActionForm } from '@/components/action-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SubmitButton } from '@/components/ui/submit-button';
import { withActionToast } from '@/lib/action-toast';
import { useRouter } from 'next/navigation';

export interface PendingInviteSummary {
  id: string;
  householdName: string;
  role: Role;
}

export function OnboardingForm({
  pendingInvites = [],
}: {
  pendingInvites?: PendingInviteSummary[];
}): React.ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const action = withActionToast(
    async (formData: FormData) => {
      await createHouseholdAction(String(formData.get('name') || 'Minha casa'));
      startTransition(() => {
        router.push('/dashboard');
        router.refresh();
      });
    },
    {
      loading: 'Criando household…',
      success: 'Household criado',
    },
  );

  return (
    <AuthShell eyebrow="Começar">
      <AuthCardHeader
        title="Criar seu household"
        description="Categorias padrão e o centro Pessoa Física já entram prontos. Depois você convida a família em Configurações → Família."
      />

      {pendingInvites.length > 0 ? (
        <div className="mb-8 space-y-3">
          <p className="text-sm font-medium">Ou aceite um convite</p>
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{invite.householdName}</p>
                <p className="text-xs text-muted-foreground">
                  Papel: {MEMBER_ROLE_LABEL[invite.role]}
                </p>
              </div>
              <ActionForm
                action={acceptInviteByIdAction}
                successMessage="Convite aceito"
                loadingMessage="Aceitando…"
              >
                <input type="hidden" name="invitationId" value={invite.id} />
                <Button type="submit" size="sm">
                  Aceitar
                </Button>
              </ActionForm>
            </div>
          ))}
          <Separator />
          <p className="text-xs text-muted-foreground">Ou crie um household novo abaixo.</p>
        </div>
      ) : null}

      <form action={action} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Nome do household</Label>
          <Input id="name" name="name" defaultValue="Casa" required className="bg-card" />
        </div>
        <SubmitButton className="w-full" size="lg" pendingLabel="Criando…">
          Criar e continuar
        </SubmitButton>
      </form>
      <AuthFooterNote />
    </AuthShell>
  );
}
