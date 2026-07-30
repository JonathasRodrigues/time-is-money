'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { parseBrlToCents } from '@tim/domain';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { nativeSelectClassName } from '@/components/page-header';
import { SubmitButton } from '@/components/ui/submit-button';
import { ActionForm } from '@/components/action-form';
import { createMonthlySeriesAction, createReceivableAction } from '@/lib/api/mutations';

type ReceivableFormKind = 'one_off' | 'monthly';

const KIND_META: Record<
  ReceivableFormKind,
  { title: string; description: string; submit: string }
> = {
  one_off: {
    title: 'Receita avulsa',
    description: 'Salário atrasado, 13º, freela… Ou gere vários meses de uma vez.',
    submit: 'Registrar receita',
  },
  monthly: {
    title: 'Receita mensal',
    description: 'Salário, VR… Todo mês o app avisa e você confirma o valor.',
    submit: 'Criar receita fixa',
  },
};

function parseAmountToCents(raw: string): number | null {
  const cents = parseBrlToCents(raw);
  if (cents == null || cents <= 0) return null;
  return cents;
}

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function NewReceivableSheet({
  centers,
  incomeCategories,
  accounts,
  defaultCostCenterId,
  defaultDate,
}: {
  centers: Array<{ id: string; name: string }>;
  incomeCategories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  defaultCostCenterId?: string;
  defaultDate: string;
}): React.ReactElement {
  const [kind, setKind] = useState<ReceivableFormKind>('one_off');
  const [alreadyReceived, setAlreadyReceived] = useState(true);
  const [repeatMonths, setRepeatMonths] = useState(false);
  const [monthCount, setMonthCount] = useState(12);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [materializeYear, setMaterializeYear] = useState(true);
  const meta = KIND_META[kind];

  const monthlyCents = parseAmountToCents(monthlyAmount);
  const effectiveMonths = repeatMonths ? Math.max(2, Math.min(48, monthCount)) : 1;
  const scheduleTotalCents =
    monthlyCents != null && effectiveMonths > 1 ? monthlyCents * effectiveMonths : null;

  const oneOffSuccess = useMemo(() => {
    if (effectiveMonths > 1) {
      return alreadyReceived
        ? `${effectiveMonths} receitas registradas`
        : `${effectiveMonths} receitas a receber criadas`;
    }
    return alreadyReceived ? 'Receita registrada' : 'Receita a receber criada';
  }, [alreadyReceived, effectiveMonths]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Adicionar
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Adicionar receita</SheetTitle>
          <SheetDescription>
            Avulsa, em massa (vários meses) ou fixa mensal. Planilha anual em Importar/Exportar.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={kind}
            onValueChange={(value) => {
              if (value === 'one_off' || value === 'monthly') {
                setKind(value);
              }
            }}
            className="w-full justify-stretch bg-muted/40"
            aria-label="Tipo de receita"
          >
            <ToggleGroupItem value="one_off" className="flex-1 px-2 text-xs sm:text-sm">
              Avulsa / em massa
            </ToggleGroupItem>
            <ToggleGroupItem value="monthly" className="flex-1 px-2 text-xs sm:text-sm">
              Mensal
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="space-y-1">
            <p className="text-sm font-medium">{meta.title}</p>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>

          {kind === 'one_off' ? (
            <ActionForm
              action={createReceivableAction}
              loadingMessage="Registrando receita…"
              successMessage={oneOffSuccess}
              className="grid gap-3"
            >
              <input type="hidden" name="type" value="income" />
              <input type="hidden" name="status" value={alreadyReceived ? 'paid' : 'pending'} />
              <input type="hidden" name="installmentCount" value={String(effectiveMonths)} />
              <div className="grid gap-1.5">
                <Label htmlFor="rec-desc">Descrição</Label>
                <Input
                  id="rec-desc"
                  name="description"
                  required
                  placeholder="Salário · Empresa Tal"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rec-date">
                  {effectiveMonths > 1
                    ? alreadyReceived
                      ? 'Data do primeiro recebimento'
                      : 'Primeira data prevista'
                    : alreadyReceived
                      ? 'Data do recebimento'
                      : 'Data prevista'}
                </Label>
                <DateInput id="rec-date" name="date" required defaultValue={defaultDate} />
                <p className="text-xs text-muted-foreground">
                  {effectiveMonths > 1
                    ? 'As demais datas avançam um mês a cada parcela (ex.: 3, 6 ou 12 meses).'
                    : 'Pode ser uma data passada para lançamento retroativo.'}
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rec-amount">
                  {effectiveMonths > 1 ? 'Valor por mês (R$)' : 'Valor (R$)'}
                </Label>
                <MoneyInput
                  id="rec-amount"
                  name="amount"
                  min="0.01"
                  required
                  placeholder="Ex.: 5000,00"
                  value={monthlyAmount}
                  onValueChange={setMonthlyAmount}
                />
                {scheduleTotalCents != null ? (
                  <p className="text-xs text-muted-foreground">
                    Total {alreadyReceived ? 'lançado' : 'planejado'}:{' '}
                    {formatBrl(scheduleTotalCents)} ({effectiveMonths}×)
                  </p>
                ) : null}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input accent-primary"
                  checked={alreadyReceived}
                  onChange={(event) => setAlreadyReceived(event.target.checked)}
                />
                Já recebi
              </label>
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border border-input accent-primary"
                    checked={repeatMonths}
                    onChange={(event) => setRepeatMonths(event.target.checked)}
                  />
                  Gerar vários meses (parcial ou ano todo)
                </label>
                {repeatMonths ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="rec-months">Quantidade de meses</Label>
                    <Input
                      id="rec-months"
                      type="number"
                      min={2}
                      max={48}
                      value={monthCount}
                      onChange={(event) => setMonthCount(Number(event.target.value) || 12)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {alreadyReceived
                        ? `Cria ${effectiveMonths} lançamentos pagos no extrato (mesmo valor).`
                        : `Cria ${effectiveMonths} itens em Contas a receber com o mesmo valor.`}
                    </p>
                  </div>
                ) : null}
              </div>
              <CenterCategoryAccountFields
                prefix="rec"
                centers={centers}
                categories={incomeCategories}
                accounts={accounts}
                defaultCostCenterId={defaultCostCenterId}
              />
              <SubmitButton pendingLabel="Salvando…">
                {effectiveMonths > 1 ? `Criar ${effectiveMonths} receitas` : meta.submit}
              </SubmitButton>
            </ActionForm>
          ) : null}

          {kind === 'monthly' ? (
            <ActionForm
              action={createMonthlySeriesAction}
              loadingMessage="Criando receita…"
              successMessage={
                materializeYear
                  ? 'Receita fixa criada (12 meses materializados)'
                  : 'Receita fixa criada'
              }
              className="grid gap-3"
            >
              <input type="hidden" name="type" value="income" />
              <input type="hidden" name="materializeMonths" value={materializeYear ? '12' : '2'} />
              <div className="grid gap-1.5">
                <Label htmlFor="inc-desc">Descrição</Label>
                <Input
                  id="inc-desc"
                  name="description"
                  required
                  placeholder="Salário · Empresa Tal"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="inc-day">Dia previsto</Label>
                  <Input
                    id="inc-day"
                    name="dueDay"
                    type="number"
                    min={1}
                    max={28}
                    required
                    defaultValue={5}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="inc-amount">Valor padrão (R$) — opcional</Label>
                  <MoneyInput
                    id="inc-amount"
                    name="defaultAmount"
                    min="0"
                    placeholder="Vazio = média"
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input accent-primary"
                  checked={materializeYear}
                  onChange={(event) => setMaterializeYear(event.target.checked)}
                />
                Materializar 12 meses a partir de agora
              </label>
              <p className="text-xs text-muted-foreground">
                Sem isso, só o mês atual e o próximo entram na fila; o restante aparece ao navegar o
                calendário.
              </p>
              <CenterCategoryAccountFields
                prefix="inc"
                centers={centers}
                categories={incomeCategories}
                accounts={accounts}
                defaultCostCenterId={defaultCostCenterId}
              />
              <SubmitButton pendingLabel="Criando…">{meta.submit}</SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CenterCategoryAccountFields({
  prefix,
  centers,
  categories,
  accounts,
  defaultCostCenterId,
}: {
  prefix: string;
  centers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  defaultCostCenterId?: string;
}): React.ReactElement {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${prefix}-center`}>Centro</Label>
        <select
          id={`${prefix}-center`}
          name="costCenterId"
          required
          className={nativeSelectClassName}
          defaultValue={defaultCostCenterId ?? centers[0]?.id}
        >
          {centers.map((center) => (
            <option key={center.id} value={center.id}>
              {center.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${prefix}-cat`}>Categoria</Label>
        <select
          id={`${prefix}-cat`}
          name="categoryId"
          required
          className={nativeSelectClassName}
          defaultValue={categories[0]?.id}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${prefix}-acc`}>Conta</Label>
        <select
          id={`${prefix}-acc`}
          name="accountId"
          required
          className={nativeSelectClassName}
          defaultValue={accounts[0]?.id}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
