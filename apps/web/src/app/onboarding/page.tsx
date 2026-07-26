import { redirect } from 'next/navigation';
import { createHouseholdAction } from '@/server/actions';
import { getAuthSession } from '@/server/db';
import { AuthCardHeader, AuthFooterNote, AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function OnboardingPage(): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session) redirect('/sign-in');
  if (session.householdId) redirect('/dashboard');

  async function action(formData: FormData) {
    'use server';
    await createHouseholdAction(String(formData.get('name') || 'Minha casa'));
    redirect('/dashboard');
  }

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
        <Button type="submit" className="w-full" size="lg">
          Criar e continuar
        </Button>
      </form>
      <AuthFooterNote />
    </AuthShell>
  );
}
