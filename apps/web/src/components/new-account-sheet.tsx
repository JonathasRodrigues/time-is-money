'use client';

import { useState } from 'react';
import { CARD_MODE_LABEL, cardHasCredit, formatCentsForBrInput, type CardMode } from '@tim/domain';
import { Check, Plus, Wallet } from 'lucide-react';
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
import { createBankAccountsAction } from '@/lib/api/mutations';
import { cn } from '@/lib/utils';

type Option = { id: string; name: string };

const CARD_MODES: CardMode[] = ['credit', 'debit', 'both'];

export function NewAccountSheet({
  centers,
  banks,
  disabled = false,
  boundInstitutionId,
  boundInstitutionName,
  triggerLabel = 'Nova conta',
  triggerVariant = 'outline',
  compact = false,
}: {
  centers: Option[];
  banks: Option[];
  /** @deprecated Caixinhas usam NewPotSheet — mantido só para callers legados. */
  parentOptions?: Option[];
  disabled?: boolean;
  boundInstitutionId?: string;
  boundInstitutionName?: string;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  compact?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const bound = Boolean(boundInstitutionId);
  const [includeChecking, setIncludeChecking] = useState(true);
  const [includeSavings, setIncludeSavings] = useState(true);
  const [includeCash, setIncludeCash] = useState(!bound);
  const [includeCard, setIncludeCard] = useState(true);
  const [includePot, setIncludePot] = useState(false);
  const [cardMode, setCardMode] = useState<CardMode>('both');
  const showCredit = cardHasCredit(cardMode);

  function resetToggles(): void {
    setIncludeChecking(true);
    setIncludeSavings(true);
    setIncludeCash(!bound);
    setIncludeCard(true);
    setIncludePot(false);
    setCardMode('both');
  }

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (next) resetToggles();
  }

  function setChecking(next: boolean): void {
    setIncludeChecking(next);
    if (!next && !includeSavings && !includeCash) {
      setIncludeCard(false);
      setIncludePot(false);
    }
  }

  const hasParentAccount = includeChecking || includeSavings || includeCash;
  const canHaveCard = hasParentAccount && (bound || includeChecking || includeSavings);
  const selectedCount =
    (includeChecking ? 1 : 0) + (includeSavings ? 1 : 0) + (includeCash ? 1 : 0);
  const canSubmit = selectedCount > 0;
  const bankLabel = boundInstitutionName ?? 'este banco';

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button type="button" variant={triggerVariant} size="sm" disabled={disabled}>
          {compact ? <Plus className="size-3.5" /> : <Wallet className="size-3.5" />}
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle>Nova conta</SheetTitle>
          <SheetDescription>
            {bound
              ? `Corrente, poupança, cartão e reserva em ${bankLabel}. Cartão e caixinha ficam na conta, não no banco.`
              : 'Monte a conta: saldos, cartão e reserva opcionais.'}
          </SheetDescription>
        </SheetHeader>

        <ActionForm
          action={createBankAccountsAction}
          successMessage={
            selectedCount > 1 || includeCard || includePot ? 'Contas criadas' : 'Conta criada'
          }
          invalidate={['settings', 'money']}
          onSuccess={() => handleOpenChange(false)}
          className="flex flex-1 flex-col gap-4 px-5 py-5"
        >
          {bound ? <input type="hidden" name="institutionId" value={boundInstitutionId} /> : null}
          <input type="hidden" name="includeChecking" value={includeChecking ? '1' : '0'} />
          <input type="hidden" name="includeSavings" value={includeSavings ? '1' : '0'} />
          <input type="hidden" name="includeCash" value={includeCash ? '1' : '0'} />
          <input
            type="hidden"
            name="includeCreditCard"
            value={includeCard && canHaveCard ? '1' : '0'}
          />
          <input
            type="hidden"
            name="includePot"
            value={includePot && hasParentAccount ? '1' : '0'}
          />

          {bound ? (
            <div className="rounded-xl border bg-muted/30 px-3 py-2.5 text-sm">
              <p className="text-xs text-muted-foreground">Banco</p>
              <p className="font-medium">{boundInstitutionName}</p>
            </div>
          ) : includeChecking || includeSavings ? (
            <div className="grid gap-1.5">
              <Label htmlFor="new-account-bank">Banco</Label>
              <select
                id="new-account-bank"
                name="institutionId"
                className={nativeSelectClassName}
                required={includeChecking || includeSavings || includeCard}
              >
                <option value="">—</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="new-account-center">Centro</Label>
            <select
              id="new-account-center"
              name="costCenterId"
              className={nativeSelectClassName}
              required
              defaultValue={centers[0]?.id}
            >
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 rounded-xl border p-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check
                  className={cn(
                    'size-3.5',
                    includeChecking ? 'text-emerald-600' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium">Conta corrente</p>
                  <p className="text-xs text-muted-foreground">PIX, débito e dia a dia</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeChecking}
                onChange={(event) => setChecking(event.target.checked)}
                className="size-4 rounded border"
              />
            </label>
            {includeChecking ? (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="new-checking-name">Nome</Label>
                  <Input
                    id="new-checking-name"
                    name="checkingName"
                    required
                    defaultValue={
                      boundInstitutionName
                        ? `Conta corrente ${boundInstitutionName}`
                        : 'Conta corrente'
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-checking-balance">Saldo atual (R$)</Label>
                  <MoneyInput
                    id="new-checking-balance"
                    name="checkingBalance"
                    min="0"
                    defaultValue={formatCentsForBrInput(0)}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-xl border p-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check
                  className={cn(
                    'size-3.5',
                    includeSavings ? 'text-emerald-600' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium">Poupança</p>
                  <p className="text-xs text-muted-foreground">
                    Conta irmã — não é caixinha/reserva
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeSavings}
                onChange={(event) => setIncludeSavings(event.target.checked)}
                className="size-4 rounded border"
              />
            </label>
            {includeSavings ? (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="new-savings-name">Nome</Label>
                  <Input
                    id="new-savings-name"
                    name="savingsName"
                    required
                    defaultValue={
                      boundInstitutionName ? `Poupança ${boundInstitutionName}` : 'Poupança'
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-savings-balance">Saldo atual (R$)</Label>
                  <MoneyInput
                    id="new-savings-balance"
                    name="savingsBalance"
                    min="0"
                    defaultValue={formatCentsForBrInput(0)}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {!bound ? (
            <div className="grid gap-3 rounded-xl border p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Check
                    className={cn(
                      'size-3.5',
                      includeCash ? 'text-emerald-600' : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-medium">Dinheiro</p>
                    <p className="text-xs text-muted-foreground">Espécie / carteira, sem banco</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={includeCash}
                  onChange={(event) => setIncludeCash(event.target.checked)}
                  className="size-4 rounded border"
                />
              </label>
              {includeCash ? (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-cash-name">Nome</Label>
                    <Input id="new-cash-name" name="cashName" required defaultValue="Dinheiro" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-cash-balance">Saldo atual (R$)</Label>
                    <MoneyInput
                      id="new-cash-balance"
                      name="cashBalance"
                      min="0"
                      defaultValue={formatCentsForBrInput(0)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {hasParentAccount ? (
            <div className="space-y-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Da conta (não do banco)
              </p>

              <div className="grid gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Check
                      className={cn(
                        'size-3.5',
                        includeCard && canHaveCard ? 'text-emerald-600' : 'text-muted-foreground',
                      )}
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-medium">Cartão</p>
                      <p className="text-xs text-muted-foreground">
                        Vinculado à {includeChecking ? 'conta corrente' : 'conta'} — fatura e débito
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeCard && canHaveCard}
                    disabled={!canHaveCard}
                    onChange={(event) => setIncludeCard(event.target.checked)}
                    className="size-4 rounded border"
                  />
                </label>

                {includeCard && canHaveCard ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor="new-card-name">Nome do cartão</Label>
                      <Input
                        id="new-card-name"
                        name="cardName"
                        required
                        defaultValue={
                          boundInstitutionName ? `Cartão ${boundInstitutionName}` : 'Cartão'
                        }
                      />
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
                    <div className="grid gap-1.5">
                      <Label htmlFor="new-card-last">Final</Label>
                      <Input
                        id="new-card-last"
                        name="cardLastFour"
                        maxLength={4}
                        pattern="\d{4}"
                        placeholder="1234"
                      />
                    </div>
                    {showCredit ? (
                      <>
                        <div className="grid gap-1.5">
                          <Label htmlFor="new-card-limit">Limite (R$)</Label>
                          <MoneyInput
                            id="new-card-limit"
                            name="creditLimit"
                            min="0"
                            defaultValue="0"
                          />
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
                    ) : (
                      <p className="text-xs text-muted-foreground sm:col-span-2">
                        Só débito: sem limite nem fatura — compras saem da conta.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Check
                      className={cn(
                        'size-3.5',
                        includePot ? 'text-emerald-600' : 'text-muted-foreground',
                      )}
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-medium">Reserva / caixinha</p>
                      <p className="text-xs text-muted-foreground">
                        Dentro da conta (ex.: viagem, emergência)
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includePot}
                    onChange={(event) => setIncludePot(event.target.checked)}
                    className="size-4 rounded border"
                  />
                </label>
                {includePot ? (
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="new-pot-name">Nome da reserva</Label>
                      <Input
                        id="new-pot-name"
                        name="potName"
                        required
                        defaultValue="Reserva"
                        placeholder="Reserva de emergência"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="new-pot-balance">Saldo (R$)</Label>
                      <MoneyInput
                        id="new-pot-balance"
                        name="potBalance"
                        min="0"
                        defaultValue={formatCentsForBrInput(0)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {!canSubmit ? (
            <p className="text-sm text-destructive" role="alert">
              Marque ao menos uma conta para criar.
            </p>
          ) : null}

          <SubmitButton
            className="mt-auto w-full"
            pendingLabel="Adicionando…"
            disabled={!canSubmit}
          >
            {selectedCount > 1 || includeCard || includePot
              ? 'Adicionar contas'
              : 'Adicionar conta'}
          </SubmitButton>
        </ActionForm>
      </SheetContent>
    </Sheet>
  );
}
