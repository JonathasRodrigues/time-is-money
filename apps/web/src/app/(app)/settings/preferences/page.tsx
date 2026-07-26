export const dynamic = 'force-dynamic';

import { accounts, costCenters, userPreferences } from '@tim/db';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { PageHeader, nativeSelectClassName } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { updatePreferencesAction } from '@/server/actions';
import { getAuthSession, getDb } from '@/server/db';

export default async function PreferencesPage(): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');
  const db = getDb();
  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(
      and(
        eq(userPreferences.householdId, session.householdId),
        eq(userPreferences.userId, session.userId),
      ),
    )
    .limit(1);
  const [centers, accs] = await Promise.all([
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Preferências"
        description="Notificações, defaults e comportamento do Jarvis."
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Conta</CardTitle>
          <CardDescription>Ajustes pessoais neste household</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updatePreferencesAction} className="flex flex-col gap-5">
            <div className="space-y-3">
              <p className="text-sm font-medium">Notificações</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="emailDueReminders"
                  defaultChecked={prefs?.emailDueReminders ?? true}
                />
                E-mails de vencimento (Resend)
              </label>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="windowsDays">Janelas (dias, separados por vírgula)</Label>
                <Input
                  id="windowsDays"
                  name="windowsDays"
                  defaultValue={(prefs?.reminderWindowsDays ?? [7, 3, 1]).join(',')}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="weeklySummary" defaultChecked={prefs?.weeklySummary} />
                Resumo semanal
              </label>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Recebimento</p>
              <p className="text-xs text-muted-foreground">
                Fallback se você ainda não cadastrou receitas mensais em Contas a pagar. Com
                salário/VR cadastrados, o aviso lista cada um para confirmar o valor assim que o mês
                começa.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="incomeDay">Dia do mês (1–28)</Label>
                <Input
                  id="incomeDay"
                  name="incomeDay"
                  type="number"
                  min={1}
                  max={28}
                  placeholder="Ex.: 5"
                  defaultValue={prefs?.incomeDay ?? ''}
                  className="max-w-[8rem]"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Jarvis</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="ttsEnabled" defaultChecked={prefs?.ttsEnabled} />
                Ler respostas em voz alta
              </label>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defaultCostCenterId">Centro padrão</Label>
                <select
                  id="defaultCostCenterId"
                  name="defaultCostCenterId"
                  className={nativeSelectClassName}
                  defaultValue={prefs?.defaultCostCenterId ?? ''}
                >
                  <option value="">—</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defaultAccountId">Conta padrão</Label>
                <select
                  id="defaultAccountId"
                  name="defaultAccountId"
                  className={nativeSelectClassName}
                  defaultValue={prefs?.defaultAccountId ?? ''}
                >
                  <option value="">—</option>
                  {accs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" className="w-fit">
              Salvar preferências
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
