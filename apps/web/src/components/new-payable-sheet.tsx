'use client';

import { useMemo, useState } from 'react';
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
import { createMonthlySeriesAction, createPayableExpenseAction } from '@/lib/api/mutations';
import { type PaymentMethodOption } from '@/components/payment-method-options';
import { PaymentMethodSelectGroups } from '@/components/payment-method-select-groups';

type PayableFormKind = 'variable' | 'fixed';

/** Valor especial: forma definida só na quitação. */
const DEFER_METHOD_ID = '';

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
    description: 'Pontual neste período — vacina, mecânico, compra no cartão…',
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
  paymentMethods = [],
  creditCards = [],
  defaultCostCenterId,
  defaultDueOn,
}: {
  centers: Array<{ id: string; name: string }>;
  expenseCategories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  paymentMethods?: PaymentMethodOption[];
  creditCards?: Array<{ id: string; paymentAccountId: string }>;
  defaultCostCenterId?: string;
  defaultDueOn: string;
}): React.ReactElement {
  const [kind, setKind] = useState<PayableFormKind>('variable');
  const [status, setStatus] = useState<'paid' | 'pending'>('pending');
  const [methodId, setMethodId] = useState(DEFER_METHOD_ID);
  const [parcelar, setParcelar] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [parcelAmount, setParcelAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [amountSource, setAmountSource] = useState<'parcel' | 'total'>('parcel');

  const meta = KIND_META[kind];
  const categories = expenseCategories;

  const accountMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === 'account'),
    [paymentMethods],
  );
  const cardMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === 'credit_card'),
    [paymentMethods],
  );

  /** Cartão sempre disponível; no crédito a compra vai para a fatura (vira variável paga). */
  const selectableMethods = paymentMethods;
  const selectedMethod =
    methodId === DEFER_METHOD_ID
      ? null
      : (selectableMethods.find((method) => method.id === methodId) ?? null);
  const useCard = selectedMethod?.type === 'credit_card';
  /** Crédito = compra já no cartão (sempre “pago” na fatura). */
  const isPaid = useCard || status === 'paid';
  const allowDefer = !isPaid;

  const isParcelado = !isPaid && !useCard && parcelar && installmentCount > 1;
  const effectiveInstallmentCount = isParcelado ? installmentCount : 1;

  const parcelCents = parseAmountToCents(parcelAmount);
  const totalCents = parseAmountToCents(totalAmount);
  const canSubmitParcelado = totalCents != null && totalCents > 0;
  const totalAmountForSubmit =
    totalCents != null ? normalizeMoneyFormValue(formatCentsForBrInput(totalCents)) : '';

  const fallbackAccountId = (() => {
    if (useCard && selectedMethod?.creditCardId) {
      const card = creditCards.find((item) => item.id === selectedMethod.creditCardId);
      if (card) return card.paymentAccountId;
    }
    if (selectedMethod?.accountId) return selectedMethod.accountId;
    return accounts[0]?.id ?? accountMethods[0]?.accountId ?? '';
  })();

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

  function onMethodChange(nextId: string) {
    setMethodId(nextId);
    const next = selectableMethods.find((method) => method.id === nextId);
    if (next?.type === 'credit_card') {
      // Crédito não é série fixa — lança compra na fatura.
      setKind('variable');
      setParcelar(false);
      setStatus('paid');
    }
  }

  function onStatusChange(next: 'paid' | 'pending') {
    setStatus(next);
    if (next === 'pending') {
      if (selectedMethod?.type === 'credit_card') {
        setMethodId(DEFER_METHOD_ID);
      }
    } else {
      setParcelar(false);
      if (methodId === DEFER_METHOD_ID && accountMethods[0]) {
        setMethodId(accountMethods[0].id);
      }
    }
  }

  const variableSuccess = useCard
    ? 'Compra adicionada à fatura do cartão'
    : isPaid
      ? 'Pagamento registrado'
      : 'Adicionado em contas a pagar';
  const variableSubmit = useCard
    ? 'Salvar na fatura'
    : isPaid
      ? 'Registrar pago'
      : isParcelado
        ? `Criar ${installmentCount} parcelas`
        : meta.submit;

  const dateLabel = useCard
    ? 'Data da compra'
    : isPaid
      ? 'Data do pagamento'
      : isParcelado
        ? '1ª parcela'
        : 'Vencimento';

  const dateHint = useCard
    ? 'Pode ser retroativa — define o ciclo da fatura. A compra não aparece item a item em a pagar.'
    : isPaid
      ? 'Pode ser retroativa (ex.: ontem). Saldo e extrato usam esta data.'
      : isParcelado
        ? 'Vencimento da primeira parcela.'
        : 'Quando a conta vence.';

  const methodHint = useCard
    ? 'Compra no crédito → entra na fatura; a conta só sai depois, ao quitar a fatura.'
    : isPaid
      ? 'Debita a conta vinculada a esta forma na data do pagamento.'
      : methodId === DEFER_METHOD_ID
        ? 'Na quitação você escolhe PIX, débito, TED ou crédito.'
        : 'Sugestão para a quitação — você pode mudar na hora de pagar.';

  const amountRequired = isPaid;
  const canSubmitPaid =
    !isPaid ||
    (useCard
      ? Boolean(selectedMethod?.creditCardId)
      : Boolean(selectedMethod?.type === 'account' && selectedMethod.accountId));

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
          <SheetDescription>
            Já pago (PIX/conta ou crédito) ou pendente. No crédito, a compra entra na fatura.
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
              if (value === 'variable' || value === 'fixed') {
                setKind(value);
                if (value === 'fixed' && selectedMethod?.type === 'credit_card') {
                  setMethodId(DEFER_METHOD_ID);
                }
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
              action={createPayableExpenseAction}
              loadingMessage="Criando…"
              successMessage={variableSuccess}
              className="grid gap-3"
            >
              <input type="hidden" name="installmentCount" value={effectiveInstallmentCount} />
              <input type="hidden" name="accountId" value={fallbackAccountId} />
              <input type="hidden" name="status" value={isPaid ? 'paid' : 'pending'} />
              {selectedMethod?.type === 'account' && selectedMethod.paymentRail ? (
                <input type="hidden" name="paymentRail" value={selectedMethod.paymentRail} />
              ) : null}
              {useCard && selectedMethod?.creditCardId ? (
                <input type="hidden" name="creditCardId" value={selectedMethod.creditCardId} />
              ) : null}
              {isParcelado ? (
                <input type="hidden" name="amount" value={totalAmountForSubmit} />
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor="var-desc">Descrição</Label>
                <Input
                  id="var-desc"
                  name="description"
                  required
                  placeholder={isPaid ? 'Sorvete · padaria' : 'Mecânico · revisão'}
                />
              </div>

              <div className="grid gap-2">
                <Label>Situação</Label>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={useCard ? 'paid' : status}
                  onValueChange={(value) => {
                    if (value === 'paid' || value === 'pending') onStatusChange(value);
                  }}
                  className="w-full bg-muted/50"
                >
                  <ToggleGroupItem
                    value="pending"
                    className="flex-1 px-2 text-xs sm:text-sm"
                    disabled={useCard}
                  >
                    Ainda não paguei
                  </ToggleGroupItem>
                  <ToggleGroupItem value="paid" className="flex-1 px-2 text-xs sm:text-sm">
                    Já paguei
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">
                  {useCard
                    ? 'No crédito a compra já está na fatura do cartão.'
                    : isPaid
                      ? 'Registra como pago (extrato + saldo). Escolha a data do pagamento abaixo — inclusive no passado.'
                      : 'Fica em Contas a pagar até você quitar.'}
                </p>
              </div>

              <PaymentMethodField
                id="var-method"
                value={methodId}
                onChange={onMethodChange}
                accountMethods={accountMethods}
                cardMethods={cardMethods}
                allowCard
                allowDefer={allowDefer}
                hint={methodHint}
                required={isPaid}
              />

              <div className="grid gap-1.5">
                <Label htmlFor="var-due">{dateLabel}</Label>
                <DateInput id="var-due" name="dueOn" required defaultValue={defaultDueOn} />
                <p className="text-[11px] text-muted-foreground">{dateHint}</p>
              </div>

              {!isPaid ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border border-input accent-primary"
                    checked={parcelar}
                    onChange={(event) => toggleParcelar(event.target.checked)}
                  />
                  Parcelado
                </label>
              ) : null}

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
                  <Label htmlFor="var-amount">
                    Valor (R$){amountRequired ? '' : ' — opcional'}
                  </Label>
                  <MoneyInput
                    id="var-amount"
                    name="amount"
                    min={amountRequired ? '0.01' : '0'}
                    required={amountRequired}
                    placeholder={amountRequired ? 'Obrigatório' : 'Opcional'}
                  />
                </div>
              )}

              <CenterCategoryFields
                prefix="var"
                centers={centers}
                categories={categories}
                defaultCostCenterId={defaultCostCenterId}
              />
              <SubmitButton
                disabled={
                  (isParcelado && !canSubmitParcelado) || fallbackAccountId === '' || !canSubmitPaid
                }
                pendingLabel="Criando…"
              >
                {variableSubmit}
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
              <input type="hidden" name="accountId" value={fallbackAccountId} />
              {selectedMethod?.type === 'account' && selectedMethod.paymentRail ? (
                <input type="hidden" name="paymentRail" value={selectedMethod.paymentRail} />
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor="fix-desc">Descrição</Label>
                <Input id="fix-desc" name="description" required placeholder="Energia elétrica" />
              </div>

              <PaymentMethodField
                id="fix-method"
                value={methodId}
                onChange={onMethodChange}
                accountMethods={accountMethods}
                cardMethods={cardMethods}
                allowCard
                allowDefer
                hint="Cartão troca para despesa variável e lança na fatura."
              />

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
              <CenterCategoryFields
                prefix="fix"
                centers={centers}
                categories={categories}
                defaultCostCenterId={defaultCostCenterId}
              />
              <SubmitButton disabled={fallbackAccountId === ''} pendingLabel="Criando…">
                {meta.submit}
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PaymentMethodField({
  id,
  value,
  onChange,
  accountMethods,
  cardMethods,
  allowCard,
  allowDefer,
  hint,
  required = false,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  accountMethods: PaymentMethodOption[];
  cardMethods: PaymentMethodOption[];
  allowCard: boolean;
  allowDefer: boolean;
  hint?: string;
  required?: boolean;
}): React.ReactElement {
  const effectiveHint =
    hint ??
    (value === DEFER_METHOD_ID
      ? 'Na quitação você escolhe PIX, débito, TED ou crédito.'
      : allowCard && cardMethods.some((m) => m.id === value)
        ? 'Compra no crédito → vai direto para a fatura do cartão.'
        : 'Sugestão para a quitação — você pode mudar na hora de pagar.');

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Forma de pagamento</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={nativeSelectClassName}
        required={required && value === DEFER_METHOD_ID ? false : required}
      >
        {allowDefer ? <option value={DEFER_METHOD_ID}>Definir na hora de pagar</option> : null}
        <PaymentMethodSelectGroups
          accountMethods={accountMethods}
          cardMethods={cardMethods}
          showCards={allowCard}
        />
      </select>
      <p className="text-[11px] text-muted-foreground">{effectiveHint}</p>
    </div>
  );
}

function CenterCategoryFields({
  prefix,
  centers,
  categories,
  defaultCostCenterId,
}: {
  prefix: string;
  centers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
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
    </div>
  );
}
