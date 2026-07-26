'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { withActionToast } from '@/lib/action-toast';
import { createMonthlySeriesAction, createPendingTransactionAction } from '@/server/actions';

type PayableFormKind = 'variable' | 'fixed' | 'income';

function parseAmountToCents(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
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
  income: {
    title: 'Receita mensal',
    description: 'Salário, VR… Todo mês o app avisa e você confirma o valor.',
    submit: 'Criar receita fixa',
  },
};

export function NewPayableSheet({
  centers,
  expenseCategories,
  incomeCategories,
  accounts,
  defaultCostCenterId,
  defaultDueOn,
}: {
  centers: Array<{ id: string; name: string }>;
  expenseCategories: Array<{ id: string; name: string }>;
  incomeCategories: Array<{ id: string; name: string }>;
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
  const categories = kind === 'income' ? incomeCategories : expenseCategories;
  const sheetTitle = kind === 'income' ? 'Adicionar receita' : 'Adicionar despesa';
  const isParcelado = parcelar && installmentCount > 1;
  const effectiveInstallmentCount = isParcelado ? installmentCount : 1;

  const parcelCents = parseAmountToCents(parcelAmount);
  const totalCents = parseAmountToCents(totalAmount);
  const canSubmitParcelado = totalCents != null && totalCents > 0;
  const totalAmountForSubmit = totalCents != null ? centsToInputValue(totalCents) : '';

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
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>
            {kind === 'income'
              ? 'Receita que se repete todo mês.'
              : 'Conta pontual, parcelada ou fixa mensal.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid gap-4 px-4 pb-6">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={kind}
            onValueChange={(value) => {
              if (value === 'variable' || value === 'fixed' || value === 'income') {
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
            <ToggleGroupItem value="income" className="flex-1 px-2 text-xs sm:text-sm">
              Receita
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="space-y-1">
            <p className="text-sm font-medium">{meta.title}</p>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>

          {kind === 'variable' ? (
            <form
              action={withActionToast(createPendingTransactionAction, {
                loading: 'Criando…',
                success: 'Adicionado em contas a pagar',
              })}
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
                <Input id="var-due" name="dueOn" type="date" required defaultValue={defaultDueOn} />
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
                      <Input
                        id="var-parcel"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={parcelAmount}
                        onChange={(event) => syncFromParcel(event.target.value, installmentCount)}
                        placeholder="Ex.: 200,00"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="var-total">Valor total (R$)</Label>
                      <Input
                        id="var-total"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={totalAmount}
                        onChange={(event) => syncFromTotal(event.target.value, installmentCount)}
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
                  <Input
                    id="var-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Opcional"
                  />
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
            </form>
          ) : null}

          {kind === 'fixed' ? (
            <form
              action={withActionToast(createMonthlySeriesAction, {
                loading: 'Criando conta fixa…',
                success: 'Conta fixa criada',
              })}
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
                  <Input
                    id="fix-amount"
                    name="defaultAmount"
                    type="number"
                    step="0.01"
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
            </form>
          ) : null}

          {kind === 'income' ? (
            <form
              action={withActionToast(createMonthlySeriesAction, {
                loading: 'Criando receita…',
                success: 'Receita fixa criada',
              })}
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
                  <Input
                    id="inc-amount"
                    name="defaultAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Vazio = média"
                  />
                </div>
              </div>
              <CenterCategoryAccountFields
                prefix="inc"
                centers={centers}
                categories={categories}
                accounts={accounts}
                defaultCostCenterId={defaultCostCenterId}
              />
              <SubmitButton pendingLabel="Criando…">{meta.submit}</SubmitButton>
            </form>
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
