'use client';

import { useTransition } from 'react';
import { createHouseholdAction } from '@/server/actions';
import { AuthCardHeader, AuthFooterNote, AuthShell } from '@/components/auth-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { withActionToast } from '@/lib/action-toast';
import { useRouter } from 'next/navigation';

export function OnboardingForm(): React.ReactElement {
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
        description="Categorias padrão e o centro Pessoa Física já entram prontos. Depois você convida a família como Admin."
      />
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
