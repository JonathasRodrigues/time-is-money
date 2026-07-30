'use client';

import { useState } from 'react';
import { CARD_MODE_LABEL, cardHasCredit, formatCentsForBrInput, type CardMode } from '@tim/domain';
import { Pencil } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { nativeSelectClassName } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { updateCreditCardAction } from '@/lib/api/mutations';

interface Option {
  id: string;
  name: string;
}

const CARD_MODES: CardMode[] = ['credit', 'debit', 'both'];

export function EditCreditCardDialog({
  card,
  banks,
  paymentAccounts,
  iconOnly = false,
  triggerClassName,
}: {
  card: {
    id: string;
    name: string;
    institutionId: string;
    paymentAccountId: string;
    lastFour: string | null;
    cardMode: CardMode;
    creditLimitCents: number;
    invoiceBalanceCents: number;
    closingDay: number;
    dueDay: number;
  };
  banks: Option[];
  paymentAccounts: Option[];
  iconOnly?: boolean;
  triggerClassName?: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [cardMode, setCardMode] = useState<CardMode>(card.cardMode);
  const showCredit = cardHasCredit(cardMode);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setCardMode(card.cardMode);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          size={iconOnly ? 'icon-sm' : 'sm'}
          variant={iconOnly ? 'ghost' : 'outline'}
          className={triggerClassName}
          aria-label={iconOnly ? `Editar ${card.name}` : undefined}
        >
          <Pencil className="size-3.5" />
          {iconOnly ? null : 'Editar'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cartão</DialogTitle>
          <DialogDescription>
            Função (crédito, débito ou os dois), limite e fatura quando houver crédito.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={updateCreditCardAction}
          successMessage="Cartão atualizado"
          loadingMessage="Salvando…"
          invalidate="settings"
          onSuccess={() => setOpen(false)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="creditCardId" value={card.id} />
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={`card-name-${card.id}`}>Nome</Label>
            <Input id={`card-name-${card.id}`} name="name" required defaultValue={card.name} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={`card-mode-${card.id}`}>Função</Label>
            <select
              id={`card-mode-${card.id}`}
              name="cardMode"
              className={nativeSelectClassName}
              required
              value={cardMode}
              onChange={(event) => setCardMode(event.target.value as CardMode)}
            >
              {CARD_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {CARD_MODE_LABEL[mode]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`card-bank-${card.id}`}>Banco</Label>
            <select
              id={`card-bank-${card.id}`}
              name="institutionId"
              className={nativeSelectClassName}
              required
              defaultValue={card.institutionId}
            >
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`card-pay-${card.id}`}>
              {showCredit ? 'Conta que paga a fatura' : 'Conta vinculada'}
            </Label>
            <select
              id={`card-pay-${card.id}`}
              name="paymentAccountId"
              className={nativeSelectClassName}
              required
              defaultValue={card.paymentAccountId}
            >
              {paymentAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`card-four-${card.id}`}>Final (4 dígitos)</Label>
            <Input
              id={`card-four-${card.id}`}
              name="lastFour"
              maxLength={4}
              pattern="\d{4}"
              defaultValue={card.lastFour ?? ''}
              placeholder="1234"
            />
          </div>
          {showCredit ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor={`card-limit-${card.id}`}>Limite (R$)</Label>
                <MoneyInput
                  id={`card-limit-${card.id}`}
                  name="creditLimit"
                  min="0"
                  defaultValue={formatCentsForBrInput(card.creditLimitCents)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`card-invoice-${card.id}`}>Saldo da fatura (R$)</Label>
                <MoneyInput
                  id={`card-invoice-${card.id}`}
                  name="invoiceBalance"
                  min="0"
                  defaultValue={formatCentsForBrInput(card.invoiceBalanceCents)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`card-close-${card.id}`}>Dia de fechamento</Label>
                <Input
                  id={`card-close-${card.id}`}
                  name="closingDay"
                  type="number"
                  min={1}
                  max={28}
                  required
                  defaultValue={card.closingDay}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`card-due-${card.id}`}>Dia de vencimento</Label>
                <Input
                  id={`card-due-${card.id}`}
                  name="dueDay"
                  type="number"
                  min={1}
                  max={28}
                  required
                  defaultValue={card.dueDay}
                />
              </div>
            </>
          ) : null}
          <SubmitButton className="sm:col-span-2" pendingLabel="Salvando…">
            Salvar alterações
          </SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
