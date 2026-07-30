'use client';

import { useState } from 'react';
import { CARD_MODE_LABEL, cardHasCredit, type CardMode } from '@tim/domain';
import { CreditCard, Plus } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { nativeSelectClassName } from '@/components/page-header';
import { Button } from '@/components/ui/button';
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
import { SubmitButton } from '@/components/ui/submit-button';
import { createCreditCardAction } from '@/lib/api/mutations';

type Option = { id: string; name: string };

const CARD_MODES: CardMode[] = ['credit', 'debit', 'both'];

export function NewCreditCardSheet({
  banks,
  paymentAccountOptions,
  defaultPaymentAccountId = '',
  disabled = false,
  disabledReason,
  boundInstitutionId,
  boundInstitutionName,
  boundPaymentAccountId,
  boundPaymentAccountName,
  triggerLabel = 'Novo cartão',
  triggerVariant = 'default',
  compact = false,
}: {
  banks: Option[];
  paymentAccountOptions: Option[];
  defaultPaymentAccountId?: string;
  disabled?: boolean;
  disabledReason?: string;
  boundInstitutionId?: string;
  boundInstitutionName?: string;
  /** Cartão nasce vinculado a esta conta (hierarquia: cartão → conta → banco). */
  boundPaymentAccountId?: string;
  boundPaymentAccountName?: string;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  compact?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [cardMode, setCardMode] = useState<CardMode>('both');
  const boundBank = Boolean(boundInstitutionId);
  const boundAccount = Boolean(boundPaymentAccountId);
  const institutionDefault = boundInstitutionId ?? banks[0]?.id;
  const showCredit = cardHasCredit(cardMode);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCardMode('both');
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={triggerVariant}
          disabled={disabled}
          title={disabledReason}
        >
          {compact ? <Plus className="size-3.5" /> : <CreditCard className="size-3.5" />}
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Novo cartão</SheetTitle>
          <SheetDescription>
            {boundAccount && boundPaymentAccountName
              ? `Cartão da conta ${boundPaymentAccountName} — crédito, débito ou os dois.`
              : 'O cartão fica vinculado a uma conta (e, por ela, ao banco).'}
          </SheetDescription>
        </SheetHeader>
        {disabled ? (
          <p className="text-sm text-muted-foreground">
            {disabledReason ?? 'Cadastre uma conta antes de adicionar cartão.'}
          </p>
        ) : (
          <ActionForm
            action={createCreditCardAction}
            successMessage="Cartão criado"
            invalidate="settings"
            onSuccess={() => setOpen(false)}
            className="grid gap-3 sm:grid-cols-2"
          >
            {boundBank ? (
              <input type="hidden" name="institutionId" value={boundInstitutionId} />
            ) : null}
            {boundAccount ? (
              <input type="hidden" name="paymentAccountId" value={boundPaymentAccountId} />
            ) : null}

            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="new-card-name">Nome</Label>
              <Input id="new-card-name" name="name" required placeholder="Cartão principal" />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="new-card-mode">Função</Label>
              <select
                id="new-card-mode"
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

            {boundAccount ? (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Conta</Label>
                <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                  {boundPaymentAccountName}
                  {boundInstitutionName ? (
                    <span className="ml-1 text-muted-foreground">· {boundInstitutionName}</span>
                  ) : null}
                </p>
              </div>
            ) : (
              <>
                {boundBank ? (
                  <div className="grid gap-1.5">
                    <Label>Banco</Label>
                    <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                      {boundInstitutionName}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-card-bank">Banco</Label>
                    <select
                      id="new-card-bank"
                      name="institutionId"
                      className={nativeSelectClassName}
                      required
                      defaultValue={institutionDefault}
                    >
                      {banks.map((bank) => (
                        <option key={bank.id} value={bank.id}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="new-card-payment">
                    {showCredit ? 'Conta da fatura' : 'Conta vinculada'}
                  </Label>
                  <select
                    id="new-card-payment"
                    name="paymentAccountId"
                    className={nativeSelectClassName}
                    required
                    defaultValue={defaultPaymentAccountId || paymentAccountOptions[0]?.id}
                  >
                    {paymentAccountOptions.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="new-card-last-four">Final</Label>
              <Input
                id="new-card-last-four"
                name="lastFour"
                maxLength={4}
                pattern="\d{4}"
                placeholder="1234"
              />
            </div>
            {showCredit ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-card-limit">Limite (R$)</Label>
                  <MoneyInput id="new-card-limit" name="creditLimit" min="0" defaultValue="0" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-card-invoice">Fatura atual (R$)</Label>
                  <MoneyInput
                    id="new-card-invoice"
                    name="invoiceBalance"
                    min="0"
                    defaultValue="0"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-card-closing">Fecha dia</Label>
                  <Input
                    id="new-card-closing"
                    name="closingDay"
                    type="number"
                    min={1}
                    max={28}
                    required
                    defaultValue={1}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-card-due">Vence dia</Label>
                  <Input
                    id="new-card-due"
                    name="dueDay"
                    type="number"
                    min={1}
                    max={28}
                    required
                    defaultValue={10}
                  />
                </div>
              </>
            ) : null}
            <SubmitButton className="sm:col-span-2" pendingLabel="Adicionando…">
              Adicionar cartão
            </SubmitButton>
          </ActionForm>
        )}
      </SheetContent>
    </Sheet>
  );
}
