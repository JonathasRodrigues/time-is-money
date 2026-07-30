'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { createMonthlySeriesAction, createTransactionAction } from '@/lib/api/mutations';

type ReceivableFormKind = 'one_off' | 'monthly';

const KIND_META: Record<
  ReceivableFormKind,
  { title: string; description: string; submit: string }
> = {
  one_off: {
    title: 'Receita avulsa',
    description: 'Salário atrasado, 13º, freela… Pode ser de hoje ou de uma data passada.',
    submit: 'Registrar receita',
  },
  monthly: {
    title: 'Receita mensal',
    description: 'Salário, VR… Todo mês o app avisa e você confirma o valor.',
    submit: 'Criar receita fixa',
  },
};

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
  const meta = KIND_META[kind];

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
          <SheetDescription>Avulsa (inclusive retroativa) ou fixa mensal.</SheetDescription>
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
              Avulsa
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
              action={createTransactionAction}
              loadingMessage="Registrando receita…"
              successMessage={alreadyReceived ? 'Receita registrada' : 'Receita a receber criada'}
              className="grid gap-3"
            >
              <input type="hidden" name="type" value="income" />
              <input type="hidden" name="status" value={alreadyReceived ? 'paid' : 'pending'} />
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
                  {alreadyReceived ? 'Data do recebimento' : 'Data prevista'}
                </Label>
                <DateInput id="rec-date" name="date" required defaultValue={defaultDate} />
                <p className="text-xs text-muted-foreground">
                  Pode ser uma data passada para lançamento retroativo.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rec-amount">Valor (R$)</Label>
                <MoneyInput
                  id="rec-amount"
                  name="amount"
                  min="0.01"
                  required
                  placeholder="Ex.: 5000,00"
                />
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
              <CenterCategoryAccountFields
                prefix="rec"
                centers={centers}
                categories={incomeCategories}
                accounts={accounts}
                defaultCostCenterId={defaultCostCenterId}
              />
              <SubmitButton pendingLabel="Salvando…">{meta.submit}</SubmitButton>
            </ActionForm>
          ) : null}

          {kind === 'monthly' ? (
            <ActionForm
              action={createMonthlySeriesAction}
              loadingMessage="Criando receita…"
              successMessage="Receita fixa criada"
              className="grid gap-3"
            >
              <input type="hidden" name="type" value="income" />
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
