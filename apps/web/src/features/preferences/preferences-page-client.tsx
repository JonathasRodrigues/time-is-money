'use client';

import { useQuery } from '@tanstack/react-query';
import type { PreferencesResponse } from '@tim/api-contract';
import { PageHeader, nativeSelectClassName } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { PageSkeleton } from '@/components/page-skeletons';
import { ActionForm } from '@/components/action-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';
import { updatePreferencesAction } from '@/lib/api/mutations';
import { cn } from '@/lib/utils';

function PreferenceSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="space-y-4 rounded-2xl border bg-muted/10 p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CheckboxRow({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint?: string;
}): React.ReactElement {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border bg-background px-3.5 py-3',
        'transition-colors hover:bg-muted/30',
      )}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 rounded border-input"
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

function PreferencesContent({ data }: { data: PreferencesResponse }): React.ReactElement {
  const { lookups } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Preferências"
        description="Notificações, aparência, defaults e comportamento do Jarvis."
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle className="text-base">Conta</CardTitle>
          <CardDescription>Ajustes pessoais neste household</CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-5">
          <ActionForm
            action={updatePreferencesAction}
            successMessage="Preferências salvas"
            invalidate="settings"
            className="flex flex-col gap-5"
          >
            <PreferenceSection
              title="Notificações"
              description="Avisos por e-mail sobre vencimentos e resumo da semana."
            >
              <div className="grid gap-2">
                <CheckboxRow
                  name="emailDueReminders"
                  defaultChecked={data.emailDueReminders}
                  label="E-mails de vencimento"
                  hint="Requer Resend configurado"
                />
                <CheckboxRow
                  name="weeklySummary"
                  defaultChecked={data.weeklySummary}
                  label="Resumo semanal"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="windowsDays">Janelas (dias, separados por vírgula)</Label>
                <Input
                  id="windowsDays"
                  name="windowsDays"
                  defaultValue={data.reminderWindowsDays.join(',')}
                  className="max-w-xs"
                />
              </div>
            </PreferenceSection>

            <PreferenceSection
              title="Recebimento"
              description="Fallback se você ainda não cadastrou receitas mensais em Contas a receber."
            >
              <div className="grid gap-1.5">
                <Label htmlFor="incomeDay">Dia do mês (1–28)</Label>
                <Input
                  id="incomeDay"
                  name="incomeDay"
                  type="number"
                  min={1}
                  max={28}
                  placeholder="Ex.: 5"
                  defaultValue={data.incomeDay ?? ''}
                  className="max-w-[8rem]"
                />
              </div>
            </PreferenceSection>

            <PreferenceSection title="Aparência">
              <div className="grid gap-1.5 max-w-xs">
                <Label htmlFor="theme">Tema</Label>
                <select
                  id="theme"
                  name="theme"
                  className={nativeSelectClassName}
                  defaultValue={data.theme}
                >
                  <option value="system">Sistema</option>
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                </select>
              </div>
            </PreferenceSection>

            <PreferenceSection title="Jarvis">
              <CheckboxRow
                name="ttsEnabled"
                defaultChecked={data.ttsEnabled}
                label="Ler respostas em voz alta"
              />
            </PreferenceSection>

            <PreferenceSection
              title="Defaults"
              description="Pré-seleção em formulários de lançamento e contas."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="defaultCostCenterId">Centro padrão</Label>
                  <select
                    id="defaultCostCenterId"
                    name="defaultCostCenterId"
                    className={nativeSelectClassName}
                    defaultValue={data.defaultCostCenterId ?? ''}
                  >
                    <option value="">—</option>
                    {lookups.centers.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.name}
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
                    defaultValue={data.defaultAccountId ?? ''}
                  >
                    <option value="">—</option>
                    {lookups.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </PreferenceSection>

            <SubmitButton className="w-fit" pendingLabel="Salvando…">
              Salvar preferências
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}

export function PreferencesPageClient(): React.ReactElement {
  const query = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: () => api.preferences.get(),
  });

  return (
    <QueryBoundary
      query={query}
      skeleton={<PageSkeleton showActions={false} showTable={false} kpiCount={0} />}
    >
      {(data) => <PreferencesContent data={data} />}
    </QueryBoundary>
  );
}
