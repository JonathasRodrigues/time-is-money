'use client';

import { useMemo, useState } from 'react';
import {
  formatCreditCardPaymentMethodLabel,
  INSTANT_ACCOUNT_PAYMENT_RAILS,
  PAYMENT_RAIL_LABEL,
  type InstantAccountPaymentRail,
  type PaymentRail,
} from '@tim/domain';
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
import { createTransactionAction } from '@/lib/api/mutations';
import { cn } from '@/lib/utils';

type AccountOption = {
  id: string;
  name: string;
  allowedPaymentRails?: InstantAccountPaymentRail[];
};

export function NewTransactionSheet({
  centers,
  categories,
  accounts,
  creditCards = [],
  defaultCostCenterId,
  defaultOccurredOn,
}: {
  centers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: string }>;
  accounts: AccountOption[];
  creditCards?: Array<{
    id: string;
    name: string;
    paymentAccountId: string;
    lastFour?: string | null;
  }>;
  defaultCostCenterId?: string;
  defaultOccurredOn: string;
}): React.ReactElement {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [funding, setFunding] = useState<'account' | 'card'>('account');
  const [selectedCardId, setSelectedCardId] = useState(creditCards[0]?.id ?? '');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? '');

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const accountRails = useMemo((): PaymentRail[] => {
    // Sem config na conta = nenhuma rail (não inventar os 4 padrões).
    const allowed = selectedAccount?.allowedPaymentRails ?? [];
    return INSTANT_ACCOUNT_PAYMENT_RAILS.filter((rail) => allowed.includes(rail));
  }, [selectedAccount?.allowedPaymentRails]);

  const isExpense = type === 'expense';
  const isPaid = status === 'paid';
  const canUseCard = isExpense && isPaid && creditCards.length > 0;
  const useCard = canUseCard && funding === 'card';
  const selectedCard = creditCards.find((c) => c.id === selectedCardId);

  const dateLabel = isPaid
    ? isExpense
      ? useCard
        ? 'Data da compra'
        : 'Data do pagamento'
      : 'Data do recebimento'
    : 'Data de vencimento';

  const dateHint = isPaid
    ? isExpense
      ? useCard
        ? 'Entra na fatura via esta forma de crédito (conta vinculada não mexe agora).'
        : 'Quando o dinheiro saiu via a forma (conta vinculada).'
      : 'Quando o dinheiro entrou na conta.'
    : isExpense
      ? 'Quando a conta vence — entra em Contas a pagar.'
      : 'Quando você espera receber — entra em Contas a receber.';

  const statusPaidLabel = isExpense ? 'Já paguei' : 'Já recebi';
  const statusPendingLabel = isExpense ? 'Ainda não paguei' : 'Ainda não recebi';

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Novo
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registrar movimento</SheetTitle>
          <SheetDescription>
            Avulso no extrato. Pendências ficam em Contas a pagar / Contas a receber.
          </SheetDescription>
        </SheetHeader>
        <ActionForm
          action={createTransactionAction}
          loadingMessage="Salvando lançamento…"
          successMessage="Lançamento salvo"
          className="grid gap-4"
        >
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="status" value={status} />
          {useCard && selectedCard ? (
            <>
              <input type="hidden" name="creditCardId" value={selectedCard.id} />
              <input type="hidden" name="accountId" value={selectedCard.paymentAccountId} />
            </>
          ) : null}

          <div className="grid gap-2">
            <Label>Tipo</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={type}
              onValueChange={(value) => {
                if (value === 'expense' || value === 'income') {
                  setType(value);
                  if (value === 'income') setFunding('account');
                }
              }}
              className="w-full bg-muted/50"
            >
              <ToggleGroupItem value="expense" className="flex-1">
                Despesa
              </ToggleGroupItem>
              <ToggleGroupItem value="income" className="flex-1">
                Receita
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid gap-2">
            <Label>Situação</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={status}
              onValueChange={(value) => {
                if (value === 'paid' || value === 'pending') {
                  setStatus(value);
                  if (value === 'pending') setFunding('account');
                }
              }}
              className="w-full bg-muted/50"
            >
              <ToggleGroupItem value="paid" className="flex-1 px-2 text-xs sm:text-sm">
                {statusPaidLabel}
              </ToggleGroupItem>
              <ToggleGroupItem value="pending" className="flex-1 px-2 text-xs sm:text-sm">
                {statusPendingLabel}
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {isPaid
                ? 'Entra no extrato como concluído.'
                : isExpense
                  ? 'Fica em Contas a pagar — só com forma na conta (sem cartão).'
                  : 'Fica pendente até você confirmar / receber.'}
            </p>
          </div>

          {!isPaid && isExpense && creditCards.length > 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Pendente não aceita crédito. Para compra no cartão, marque{' '}
              <span className="font-medium text-foreground">Já paguei</span> e escolha Crédito — a
              compra entra na fatura.
            </p>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="new-amount">Valor (R$)</Label>
            <MoneyInput id="new-amount" name="amount" min="0.01" required />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-date">{dateLabel}</Label>
            <DateInput id="new-date" name="date" required defaultValue={defaultOccurredOn} />
            <p className={cn('text-xs text-muted-foreground')}>{dateHint}</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-description">Descrição</Label>
            <Input id="new-description" name="description" placeholder="Opcional" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-costCenterId">Centro de custo</Label>
            <select
              id="new-costCenterId"
              name="costCenterId"
              className={nativeSelectClassName}
              required
              defaultValue={defaultCostCenterId ?? centers[0]?.id}
            >
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-categoryId">Categoria</Label>
            <select
              id="new-categoryId"
              name="categoryId"
              className={nativeSelectClassName}
              required
              key={type}
              defaultValue={filteredCategories[0]?.id}
            >
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {canUseCard ? (
            <div className="grid gap-2">
              <Label>Forma de pagamento</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                spacing={0}
                value={funding}
                onValueChange={(value) => {
                  if (value === 'account' || value === 'card') setFunding(value);
                }}
                className="w-full bg-muted/50"
              >
                <ToggleGroupItem value="account" className="flex-1">
                  Conta
                </ToggleGroupItem>
                <ToggleGroupItem value="card" className="flex-1">
                  Crédito
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          ) : isExpense && creditCards.length > 0 && !isPaid ? (
            <div className="grid gap-1.5">
              <Label>Forma de pagamento</Label>
              <select className={nativeSelectClassName} disabled defaultValue="account">
                <option value="account">Conta (obrigação pendente)</option>
              </select>
            </div>
          ) : null}

          {useCard ? (
            <div className="grid gap-1.5">
              <Label htmlFor="new-creditCardId">Cartão</Label>
              <select
                id="new-creditCardId"
                className={nativeSelectClassName}
                required
                value={selectedCardId}
                onChange={(event) => setSelectedCardId(event.target.value)}
              >
                {creditCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {formatCreditCardPaymentMethodLabel({
                      cardName: card.name,
                      lastFour: card.lastFour ?? null,
                    })}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Forma no crédito — fatura do ciclo; banco/conta só como vínculo.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="new-accountId">Conta</Label>
                <select
                  id="new-accountId"
                  name="accountId"
                  className={nativeSelectClassName}
                  required
                  value={selectedAccountId}
                  onChange={(event) => setSelectedAccountId(event.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              {isExpense && accountRails.length > 0 ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="new-paymentRail">Meio (opcional)</Label>
                  <select
                    id="new-paymentRail"
                    name="paymentRail"
                    className={nativeSelectClassName}
                    defaultValue=""
                    key={selectedAccountId}
                  >
                    <option value="">—</option>
                    {accountRails.map((rail) => (
                      <option key={rail} value={rail}>
                        {PAYMENT_RAIL_LABEL[rail]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="new-notes">Notas (criptografadas)</Label>
            <Input id="new-notes" name="notes" />
          </div>

          <SubmitButton className="mt-2" pendingLabel="Salvando…">
            {isPaid
              ? useCard
                ? 'Salvar na fatura'
                : 'Salvar no extrato'
              : isExpense
                ? 'Adicionar a pagar'
                : 'Adicionar a receber'}
          </SubmitButton>
        </ActionForm>
      </SheetContent>
    </Sheet>
  );
}
