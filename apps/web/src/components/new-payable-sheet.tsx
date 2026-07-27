'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { formatCentsForBrInput, normalizeMoneyFormValue, parseBrlToCents } from '@tim/domain';
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
import { createMonthlySeriesAction, createPendingTransactionAction } from '@/server/actions';

type PayableFormKind = 'variable' | 'fixed';

function parseAmountToCents(raw: string): number | null {
  const cents = parseBrlToCents(raw);
  if (cents == null || cents <= 0) return null;
  return cents;
}

function centsToInputValue(cents: number): string {
  return formatCentsForBrInput(cents);
}

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const KIND_META: Record<PayableFormKind, { title: string; description: string; submit: string }> = {
  variable: {
    title: 'Conta variável',
    description: 'Pontual neste período — vacina, mecânico…',
    submit: 'Adicionar à fila',
  },
  fixed: {
    title: 'Conta fixa',
    description: 'Água, luz, imposto… Repete todo mês. Valor padrão opcional.',
    submit: 'Criar conta fixa',
  },
};

export function NewPayableSheet({
  centers,
  expenseCategories,
  accounts,
  defaultCostCenterId,
  defaultDueOn,
}: {
  centers: Array<{ id: string; name: string }>;
  expenseCategories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  defaultCostCenterId?: string;
  defaultDueOn: string;
}): React.ReactElement {
  const [kind, setKind] = useState<PayableFormKind>('variable');
  const [parcelar, setParcelar] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [parcelAmount, setParcelAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [amountSource, setAmountSource] = useState<'parcel' | 'total'>('parcel');
  const meta = KIND_META[kind];
  const categories = expenseCategories;
  const isParcelado = parcelar && installmentCount > 1;
  const effectiveInstallmentCount = isParcelado ? installmentCount : 1;

  const parcelCents = parseAmountToCents(parcelAmount);
  const totalCents = parseAmountToCents(totalAmount);
  const canSubmitParcelado = totalCents != null && totalCents > 0;
  const totalAmountForSubmit =
    totalCents != null ? normalizeMoneyFormValue(formatCentsForBrInput(totalCents)) : '';

  function syncFromParcel(raw: string, count: number) {
    setParcelAmount(raw);
    setAmountSource('parcel');
    const cents = parseAmountToCents(raw);
    if (cents == null) {
      setTotalAmount('');
      return;
    }
    setTotalAmount(centsToInputValue(cents * count));
  }

  function syncFromTotal(raw: string, count: number) {
    setTotalAmount(raw);
    setAmountSource('total');
    const cents = parseAmountToCents(raw);
    if (cents == null) {
      setParcelAmount('');
      return;
    }
    setParcelAmount(centsToInputValue(Math.floor(cents / count)));
  }

  function changeInstallmentCount(next: number) {
    const count = Number.isFinite(next) ? Math.min(48, Math.max(2, next)) : 2;
    setInstallmentCount(count);
    if (amountSource === 'total') {
      syncFromTotal(totalAmount, count);
    } else {
      syncFromParcel(parcelAmount, count);
    }
  }

  function toggleParcelar(checked: boolean) {
    setParcelar(checked);
    if (checked) {
      const count = Math.max(2, installmentCount);
      setInstallmentCount(count);
      if (amountSource === 'total') {
        syncFromTotal(totalAmount, count);
      } else {
        syncFromParcel(parcelAmount, count);
      }
    }
  }

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
          <SheetTitle>Adicionar despesa</SheetTitle>
          <SheetDescription>Conta pontual, parcelada ou fixa mensal.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid gap-4 px-4 pb-6">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={kind}
            onValueChange={(value) => {
              if (value === 'variable' || value === 'fixed') {
                setKind(value);
              }
            }}
            className="w-full justify-stretch bg-muted/40"
            aria-label="Tipo de cadastro"
          >
            <ToggleGroupItem value="variable" className="flex-1 px-2 text-xs sm:text-sm">
              Variável
            </ToggleGroupItem>
            <ToggleGroupItem value="fixed" className="flex-1 px-2 text-xs sm:text-sm">
              Fixa
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="space-y-1">
            <p className="text-sm font-medium">{meta.title}</p>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>

          {kind === 'variable' ? (
            <ActionForm
              action={createPendingTransactionAction}
              loadingMessage="Criando…"
              successMessage="Adicionado em contas a pagar"
              className="grid gap-3"
            >
              <input type="hidden" name="installmentCount" value={effectiveInstallmentCount} />
              {isParcelado ? (
                <input type="hidden" name="amount" value={totalAmountForSubmit} />
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="var-desc">Descrição</Label>
                <Input id="var-desc" name="description" required placeholder="Mecânico · revisão" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="var-due">{isParcelado ? '1ª parcela' : 'Vencimento'}</Label>
                <DateInput id="var-due" name="dueOn" required defaultValue={defaultDueOn} />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input accent-primary"
                  checked={parcelar}
                  onChange={(event) => toggleParcelar(event.target.checked)}
                />
                Parcelado
              </label>

              {isParcelado ? (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="var-installments">Quantas parcelas</Label>
                    <Input
                      id="var-installments"
                      type="number"
                      min={2}
                      max={48}
                      required
                      value={installmentCount}
                      onChange={(event) => {
                        changeInstallmentCount(Number(event.target.value));
                      }}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="var-parcel">Valor da parcela (R$)</Label>
                      <MoneyInput
                        id="var-parcel"
                        min="0.01"
                        value={parcelAmount}
                        onValueChange={(value) => syncFromParcel(value, installmentCount)}
                        placeholder="Ex.: 200,00"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="var-total">Valor total (R$)</Label>
                      <MoneyInput
                        id="var-total"
                        min="0.01"
                        value={totalAmount}
                        onValueChange={(value) => syncFromTotal(value, installmentCount)}
                        placeholder="Ex.: 800,00"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
                    {parcelCents != null && totalCents != null ? (
                      <p>
                        <span className="font-medium tabular-nums">
                          {installmentCount}× de {formatBrl(parcelCents)}
                        </span>
                        <span className="text-muted-foreground"> · total </span>
                        <span className="font-semibold tabular-nums">{formatBrl(totalCents)}</span>
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        Preencha a parcela ou o total — o outro calcula sozinho.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="var-amount">Valor (R$) — opcional</Label>
                  <MoneyInput id="var-amount" name="amount" min="0" placeholder="Opcional" />
                </div>
              )}

              <CenterCategoryAccountFields
                prefix="var"
                centers={centers}
                categories={categories}
                accounts={accounts}
                defaultCostCenterId={defaultCostCenterId}
              />
              <SubmitButton disabled={isParcelado && !canSubmitParcelado} pendingLabel="Criando…">
                {isParcelado ? `Criar ${installmentCount} parcelas` : meta.submit}
              </SubmitButton>
            </ActionForm>
          ) : null}

          {kind === 'fixed' ? (
            <ActionForm
              action={createMonthlySeriesAction}
              loadingMessage="Criando conta fixa…"
              successMessage="Conta fixa criada"
              className="grid gap-3"
            >
              <input type="hidden" name="type" value="expense" />
              <div className="grid gap-1.5">
                <Label htmlFor="fix-desc">Descrição</Label>
                <Input id="fix-desc" name="description" required placeholder="Energia elétrica" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="fix-day">Dia do vencimento</Label>
                  <Input
                    id="fix-day"
                    name="dueDay"
                    type="number"
                    min={1}
                    max={28}
                    required
                    defaultValue={10}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="fix-amount">Valor padrão (R$) — opcional</Label>
                  <MoneyInput
                    id="fix-amount"
                    name="defaultAmount"
                    min="0"
                    placeholder="Vazio = variável"
                  />
                </div>
              </div>
              <CenterCategoryAccountFields
                prefix="fix"
                centers={centers}
                categories={categories}
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
