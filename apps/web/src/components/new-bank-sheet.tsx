'use client';

import { useMemo, useState } from 'react';
import {
  BRAZILIAN_BANKS,
  CARD_MODE_LABEL,
  CUSTOM_BANK_OPTION_ID,
  cardHasCredit,
  formatCentsForBrInput,
  type CardMode,
} from '@tim/domain';
import { Building2, Check, Search } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { BankLogo } from '@/components/bank-logo';
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
import { setupBankAction } from '@/lib/api/mutations';
import { cn } from '@/lib/utils';

type Option = { id: string; name: string };

const CARD_MODES: CardMode[] = ['credit', 'debit', 'both'];

export function NewBankSheet({
  centers,
  existingBankNames = [],
}: {
  centers: Option[];
  existingBankNames?: string[];
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [includeCard, setIncludeCard] = useState(true);
  const [includeSavings, setIncludeSavings] = useState(true);
  const [cardMode, setCardMode] = useState<CardMode>('both');
  const showCredit = cardHasCredit(cardMode);

  const existing = useMemo(
    () => new Set(existingBankNames.map((name) => name.trim().toLowerCase())),
    [existingBankNames],
  );

  const selectedBank = BRAZILIAN_BANKS.find((bank) => bank.id === catalogId);
  const isCustom = catalogId === CUSTOM_BANK_OPTION_ID;
  const selectedName = isCustom ? 'Outro banco' : (selectedBank?.name ?? null);

  const filteredBanks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BRAZILIAN_BANKS.filter((bank) => {
      if (existing.has(bank.name.toLowerCase())) return false;
      if (!q) return true;
      return bank.name.toLowerCase().includes(q);
    });
  }, [existing, query]);

  function reset(): void {
    setQuery('');
    setCatalogId(null);
    setIncludeCard(true);
    setIncludeSavings(true);
    setCardMode('both');
  }

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) reset();
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Building2 className="size-3.5" />
          Novo banco
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Novo banco</SheetTitle>
          <SheetDescription>
            Escolha o banco e as contas. Cartão e reserva ficam na conta corrente, não no banco.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {!catalogId ? (
            <div className="grid gap-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar banco…"
                  className="pl-9"
                  autoFocus
                />
              </div>

              <div className="grid max-h-[min(50vh,22rem)] gap-1.5 overflow-y-auto pr-1">
                {filteredBanks.map((bank) => (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => setCatalogId(bank.id)}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 text-left text-sm transition hover:bg-accent"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <BankLogo catalogId={bank.id} name={bank.name} size="sm" />
                      <span className="truncate font-medium">{bank.name}</span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCatalogId(CUSTOM_BANK_OPTION_ID)}
                  className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <span>Outro banco…</span>
                </button>
                {filteredBanks.length === 0 ? (
                  <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                    Nenhum banco encontrado. Use “Outro banco”.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <ActionForm
              action={setupBankAction}
              successMessage="Banco configurado"
              invalidate="settings"
              onSuccess={() => handleOpenChange(false)}
              className="grid gap-4"
            >
              <input type="hidden" name="catalogId" value={catalogId} />
              <input type="hidden" name="includeCreditCard" value={includeCard ? '1' : '0'} />
              <input type="hidden" name="includeSavings" value={includeSavings ? '1' : '0'} />

              <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  {isCustom ? (
                    <BankLogo name={selectedName ?? 'Outro'} size="sm" />
                  ) : (
                    <BankLogo catalogId={catalogId} name={selectedName} size="sm" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Banco selecionado</p>
                    <p className="truncate font-medium">{selectedName}</p>
                  </div>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCatalogId(null)}>
                  Trocar
                </Button>
              </div>

              {isCustom ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="setup-custom-name">Nome do banco</Label>
                  <Input
                    id="setup-custom-name"
                    name="customName"
                    required
                    placeholder="Ex.: Banco XYZ"
                    autoFocus
                  />
                </div>
              ) : null}

              <div className="grid gap-3 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-600" aria-hidden />
                  <p className="text-sm font-medium">Conta corrente</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="setup-account-name">Nome da conta</Label>
                    <Input
                      id="setup-account-name"
                      name="accountName"
                      required
                      defaultValue={
                        selectedBank ? `Conta corrente ${selectedBank.name}` : 'Conta corrente'
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="setup-center">Centro</Label>
                    <select
                      id="setup-center"
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
                  <div className="grid gap-1.5">
                    <Label htmlFor="setup-balance">Saldo atual (R$)</Label>
                    <MoneyInput
                      id="setup-balance"
                      name="balance"
                      min="0"
                      defaultValue={formatCentsForBrInput(0)}
                    />
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          'size-3.5',
                          includeCard ? 'text-emerald-600' : 'text-muted-foreground',
                        )}
                        aria-hidden
                      />
                      <div>
                        <p className="text-sm font-medium">Cartão desta conta</p>
                        <p className="text-xs text-muted-foreground">
                          Vinculado à conta corrente — não ao banco em si
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeCard}
                      onChange={(event) => setIncludeCard(event.target.checked)}
                      className="size-4 rounded border"
                    />
                  </label>

                  {includeCard ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5 sm:col-span-2">
                        <Label htmlFor="setup-card-name">Nome do cartão</Label>
                        <Input
                          id="setup-card-name"
                          name="cardName"
                          required
                          defaultValue={selectedBank ? `Cartão ${selectedBank.name}` : 'Cartão'}
                        />
                      </div>
                      <div className="grid gap-1.5 sm:col-span-2">
                        <Label htmlFor="setup-card-mode">Função</Label>
                        <select
                          id="setup-card-mode"
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
                        <Label htmlFor="setup-card-last">Final</Label>
                        <Input
                          id="setup-card-last"
                          name="cardLastFour"
                          maxLength={4}
                          pattern="\d{4}"
                          placeholder="1234"
                        />
                      </div>
                      {showCredit ? (
                        <>
                          <div className="grid gap-1.5">
                            <Label htmlFor="setup-card-limit">Limite (R$)</Label>
                            <MoneyInput
                              id="setup-card-limit"
                              name="creditLimit"
                              min="0"
                              defaultValue="0"
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="setup-card-invoice">Fatura atual (R$)</Label>
                            <MoneyInput
                              id="setup-card-invoice"
                              name="invoiceBalance"
                              min="0"
                              defaultValue="0"
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="setup-card-closing">Fecha dia</Label>
                            <Input
                              id="setup-card-closing"
                              name="closingDay"
                              type="number"
                              min={1}
                              max={28}
                              required
                              defaultValue={1}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="setup-card-due">Vence dia</Label>
                            <Input
                              id="setup-card-due"
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
                        <div className="grid gap-1.5 sm:col-span-2">
                          <p className="text-xs text-muted-foreground">
                            Só débito: sem limite nem fatura — compras saem da conta corrente.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
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
                        Conta separada neste banco (não é caixinha)
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor="setup-savings-name">Nome da poupança</Label>
                      <Input
                        id="setup-savings-name"
                        name="savingsName"
                        required
                        defaultValue={selectedBank ? `Poupança ${selectedBank.name}` : 'Poupança'}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="setup-savings-balance">Saldo (R$)</Label>
                      <MoneyInput
                        id="setup-savings-balance"
                        name="savingsBalance"
                        min="0"
                        defaultValue={formatCentsForBrInput(0)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <SubmitButton pendingLabel="Configurando…">Criar banco com setup</SubmitButton>
            </ActionForm>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
