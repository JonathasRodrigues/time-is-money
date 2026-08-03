'use client';

import { useQuery } from '@tanstack/react-query';
import type { AccountsResponse } from '@tim/api-contract';
import {
  ACCOUNT_KIND_LABEL,
  CARD_MODE_LABEL,
  cardHasCredit,
  formatBrlFromCents,
  type AccountKind,
  type CardMode,
  type YieldType,
} from '@tim/domain';
import { Building2, CreditCard, PiggyBank, Wallet } from 'lucide-react';
import { EditAccountDialog } from '@/components/edit-account-dialog';
import { EditCreditCardDialog } from '@/components/edit-credit-card-dialog';
import { EditInstitutionRow } from '@/components/edit-institution-row';
import { BankLogo } from '@/components/bank-logo';
import { NewAccountSheet } from '@/components/new-account-sheet';
import { NewBankSheet } from '@/components/new-bank-sheet';
import { NewCreditCardSheet } from '@/components/new-credit-card-sheet';
import { NewPotSheet } from '@/components/new-pot-sheet';
import { PageHeader } from '@/components/page-header';
import { PayCreditCardInvoiceLink } from '@/components/pay-credit-card-invoice-link';
import { QueryBoundary } from '@/components/query-boundary';
import { PageSkeleton } from '@/components/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';
import { cn } from '@/lib/utils';

type BankSection = AccountsResponse['bankSections'][number];
type AccountRow = BankSection['accounts'][number];
type Lookups = AccountsResponse['lookups'];

function sectionTotals(section: BankSection): {
  assetsCents: number;
  invoiceCents: number;
  potsCents: number;
} {
  const pots = section.accounts.filter((row) => row.kind === 'investment_pot' || row.isChild);
  return {
    assetsCents: section.accounts.reduce((sum, row) => sum + row.balanceCents, 0),
    invoiceCents: section.creditCards.reduce(
      (sum, card) => (card.cardMode === 'debit' ? sum : sum + card.invoiceBalanceCents),
      0,
    ),
    potsCents: pots.reduce((sum, row) => sum + row.balanceCents, 0),
  };
}

function groupAccounts(accounts: AccountRow[]): Array<{
  root: AccountRow;
  pots: AccountRow[];
}> {
  const roots = accounts.filter((row) => !row.isChild);
  const pots = accounts.filter((row) => row.isChild);
  return roots.map((root) => ({
    root,
    pots: pots.filter((pot) => pot.parentAccountId === root.id),
  }));
}

function PotTile({
  pot,
  centers,
  banks,
  parentOptions,
}: {
  pot: AccountRow;
  centers: Lookups['centers'];
  banks: Lookups['banks'];
  parentOptions: Lookups['parentOptions'];
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-background p-3 shadow-xs sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <PiggyBank
              className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400"
              aria-hidden
            />
            <p className="truncate text-sm font-medium tracking-tight">{pot.name}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {pot.yieldLabel !== 'Sem rendimento' ? pot.yieldLabel : 'Sem rendimento'}
          </p>
        </div>
        <EditAccountDialog
          account={{
            id: pot.id,
            name: pot.name,
            kind: pot.kind as AccountKind,
            costCenterId: pot.costCenterId,
            institutionId: pot.institutionId,
            parentAccountId: pot.parentAccountId,
            balanceCents: pot.balanceCents,
            yieldType: pot.yieldType as YieldType,
            yieldBps: pot.yieldBps,
            allowedPaymentRails: pot.allowedPaymentRails,
          }}
          centers={centers}
          banks={banks}
          parentOptions={parentOptions}
          iconOnly
        />
      </div>
      <p className="mt-auto text-lg font-semibold tabular-nums tracking-tight">
        {formatBrlFromCents(pot.balanceCents)}
      </p>
    </div>
  );
}

function CreditCardTile({
  card,
  banks,
  paymentAccounts,
}: {
  card: BankSection['creditCards'][number];
  banks: Lookups['banks'];
  paymentAccounts: Lookups['paymentAccountOptions'];
}): React.ReactElement {
  const mode = card.cardMode as CardMode;
  const showCredit = cardHasCredit(mode);
  const usedPct =
    showCredit && card.creditLimitCents > 0
      ? Math.min(100, Math.round((card.invoiceBalanceCents / card.creditLimitCents) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-background to-background p-3 shadow-xs sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <CreditCard className="size-3.5 shrink-0 text-sky-700 dark:text-sky-400" aria-hidden />
            <p className="truncate text-sm font-medium tracking-tight">{card.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">
              {card.lastFour ? `•••• ${card.lastFour}` : '•••• ----'}
            </p>
            <Badge variant="outline" className="font-normal">
              {CARD_MODE_LABEL[mode]}
            </Badge>
          </div>
        </div>
        <EditCreditCardDialog
          card={{
            id: card.id,
            name: card.name,
            institutionId: card.institutionId,
            paymentAccountId: card.paymentAccountId,
            lastFour: card.lastFour,
            cardMode: mode,
            creditLimitCents: card.creditLimitCents,
            invoiceBalanceCents: card.invoiceBalanceCents,
            closingDay: card.closingDay,
            dueDay: card.dueDay,
          }}
          banks={banks}
          paymentAccounts={paymentAccounts}
          iconOnly
        />
      </div>

      {showCredit ? (
        <div className="mt-auto grid gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Fatura
              </p>
              <p className="text-lg font-semibold tabular-nums tracking-tight">
                {formatBrlFromCents(card.invoiceBalanceCents)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Disponível
              </p>
              <p className="text-sm font-medium tabular-nums">
                {formatBrlFromCents(card.availableCents)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usedPct >= 85 ? 'bg-amber-500' : 'bg-sky-600 dark:bg-sky-400',
                )}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Limite {formatBrlFromCents(card.creditLimitCents)} · fecha {card.closingDay} · vence{' '}
              {card.dueDay}
            </p>
          </div>

          <PayCreditCardInvoiceLink
            creditCardId={card.id}
            invoiceBalanceCents={card.invoiceBalanceCents}
            className="w-full"
          />
        </div>
      ) : (
        <div className="mt-auto">
          <p className="text-sm text-muted-foreground">
            Cartão só débito — sem fatura nem limite de crédito.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Débito sai direto da conta vinculada.
          </p>
        </div>
      )}
    </div>
  );
}

function BankInstitutionCard({
  section,
  lookups,
}: {
  section: BankSection;
  lookups: Lookups;
}): React.ReactElement {
  const { centers, banks, parentOptions, paymentAccountOptions } = lookups;
  const totals = sectionTotals(section);
  const isBank = section.institutionId != null;

  const bankPaymentAccounts = section.accounts
    .filter((row) => row.kind === 'checking' || row.kind === 'savings' || row.kind === 'cash')
    .map((row) => ({ id: row.id, name: row.name }));
  const paymentAccounts =
    bankPaymentAccounts.length > 0 ? bankPaymentAccounts : paymentAccountOptions;

  const bankParentOptions = section.accounts
    .filter((row) => !row.isChild)
    .map((row) => ({ id: row.id, name: row.name }));
  const parents = bankParentOptions.length > 0 ? bankParentOptions : parentOptions;

  const accountIds = new Set(section.accounts.map((row) => row.id));
  const cardsByAccount = new Map<string, BankSection['creditCards']>();
  const orphanCards: BankSection['creditCards'] = [];
  for (const card of section.creditCards) {
    if (accountIds.has(card.paymentAccountId)) {
      const list = cardsByAccount.get(card.paymentAccountId) ?? [];
      list.push(card);
      cardsByAccount.set(card.paymentAccountId, list);
    } else {
      orphanCards.push(card);
    }
  }

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="gap-3 border-b bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center">
            {isBank ? (
              <BankLogo name={section.title} size="md" />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-xl border bg-background shadow-xs">
                <Wallet className="size-4 text-muted-foreground" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1">
              <CardTitle className="truncate text-base tracking-tight sm:text-lg">
                {section.title}
              </CardTitle>
              {section.institutionId ? (
                <EditInstitutionRow institutionId={section.institutionId} name={section.title} />
              ) : null}
            </div>
            <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
              <span>
                Saldo{' '}
                <span className="tabular-nums text-foreground">
                  {formatBrlFromCents(totals.assetsCents)}
                </span>
              </span>
              {totals.potsCents > 0 ? (
                <span>
                  Reservas{' '}
                  <span className="tabular-nums text-foreground">
                    {formatBrlFromCents(totals.potsCents)}
                  </span>
                </span>
              ) : null}
              {totals.invoiceCents > 0 ? (
                <span>
                  Faturas{' '}
                  <span className="tabular-nums text-foreground">
                    {formatBrlFromCents(totals.invoiceCents)}
                  </span>
                </span>
              ) : null}
            </CardDescription>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NewAccountSheet
            centers={centers}
            banks={banks}
            parentOptions={parents}
            boundInstitutionId={section.institutionId ?? undefined}
            boundInstitutionName={section.title}
            triggerLabel="Conta"
            triggerVariant="outline"
            compact
          />
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 p-4 sm:gap-6 sm:p-5">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Contas
            </h3>
            <span className="text-xs text-muted-foreground">
              {section.accounts.filter((row) => !row.isChild).length}{' '}
              {section.accounts.filter((row) => !row.isChild).length === 1 ? 'conta' : 'contas'}
            </span>
          </div>

          {section.accounts.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma conta ainda. Adicione corrente ou poupança.
            </p>
          ) : (
            <div className="space-y-3">
              {groupAccounts(section.accounts).map(({ root, pots }) => {
                const canHoldExtras =
                  root.kind === 'checking' || root.kind === 'savings' || root.kind === 'cash';
                const accountCards = cardsByAccount.get(root.id) ?? [];

                return (
                  <div key={root.id} className="overflow-hidden rounded-xl border">
                    <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{root.name}</span>
                          <Badge variant="outline" className="font-normal">
                            {ACCOUNT_KIND_LABEL[root.kind as AccountKind]}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {root.costCenterName}
                          {root.yieldLabel !== 'Sem rendimento' ? ` · ${root.yieldLabel}` : ''}
                          {accountCards.length > 0
                            ? ` · ${accountCards.length} cartão${accountCards.length === 1 ? '' : 'ões'}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <span className="tabular-nums text-base font-semibold tracking-tight sm:mr-1 sm:text-sm">
                          {formatBrlFromCents(root.balanceCents)}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {canHoldExtras && isBank && root.institutionId ? (
                            <NewCreditCardSheet
                              banks={banks}
                              paymentAccountOptions={paymentAccounts}
                              boundInstitutionId={root.institutionId}
                              boundInstitutionName={section.title}
                              boundPaymentAccountId={root.id}
                              boundPaymentAccountName={root.name}
                              triggerLabel="Cartão"
                              triggerVariant="ghost"
                              iconOnly
                            />
                          ) : null}
                          {canHoldExtras ? (
                            <NewPotSheet
                              parentAccountId={root.id}
                              parentAccountName={root.name}
                              costCenterId={root.costCenterId}
                              institutionId={root.institutionId}
                              triggerLabel="Reserva"
                              iconOnly
                            />
                          ) : null}
                          <EditAccountDialog
                            account={{
                              id: root.id,
                              name: root.name,
                              kind: root.kind as AccountKind,
                              costCenterId: root.costCenterId,
                              institutionId: root.institutionId,
                              parentAccountId: root.parentAccountId,
                              balanceCents: root.balanceCents,
                              yieldType: root.yieldType as YieldType,
                              yieldBps: root.yieldBps,
                              allowedPaymentRails: root.allowedPaymentRails,
                            }}
                            centers={centers}
                            banks={banks}
                            parentOptions={parents}
                            iconOnly
                          />
                        </div>
                      </div>
                    </div>

                    {accountCards.length > 0 ? (
                      <div className="border-t bg-muted/10 px-3 py-3 sm:px-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            Cartões desta conta
                          </p>
                          <span className="text-[11px] text-muted-foreground">
                            {accountCards.length} {accountCards.length === 1 ? 'cartão' : 'cartões'}
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {accountCards.map((card) => (
                            <CreditCardTile
                              key={card.id}
                              card={card}
                              banks={banks}
                              paymentAccounts={paymentAccounts}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {pots.length > 0 ? (
                      <div className="border-t bg-muted/15 px-3 py-3 sm:px-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            Reservas / caixinhas
                          </p>
                          <span className="text-[11px] text-muted-foreground">
                            {pots.length} {pots.length === 1 ? 'reserva' : 'reservas'}
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {pots.map((pot) => (
                            <PotTile
                              key={pot.id}
                              pot={pot}
                              centers={centers}
                              banks={banks}
                              parentOptions={parents}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {orphanCards.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Cartões sem conta vinculada
              </h3>
              <span className="text-xs text-muted-foreground">
                {orphanCards.length} {orphanCards.length === 1 ? 'cartão' : 'cartões'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orphanCards.map((card) => (
                <CreditCardTile
                  key={card.id}
                  card={card}
                  banks={banks}
                  paymentAccounts={paymentAccounts}
                />
              ))}
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AccountsContent({ data }: { data: AccountsResponse }): React.ReactElement {
  const { bankSections, lookups, isEmpty, institutions } = data;
  const existingBankNames = institutions.map((bank) => bank.name);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bancos e contas"
        description="Banco → conta → cartão. Poupança é conta irmã; reservas (caixinhas) são opcionais."
        actions={<NewBankSheet centers={lookups.centers} existingBankNames={existingBankNames} />}
      />

      {isEmpty ? (
        <Card className="border-dashed py-14">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
              <Building2 className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Nenhum banco cadastrado</p>
              <p className="text-sm text-muted-foreground">
                Escolha o banco, as contas e o cartão fica na conta.
              </p>
            </div>
            <NewBankSheet centers={lookups.centers} existingBankNames={existingBankNames} />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {bankSections.map((section) => (
            <BankInstitutionCard key={section.key} section={section} lookups={lookups} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountsPageClient(): React.ReactElement {
  const query = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: () => api.accounts.get(),
  });

  return (
    <QueryBoundary
      query={query}
      skeleton={<PageSkeleton showActions={false} showTable={false} kpiCount={0} />}
    >
      {(data) => <AccountsContent data={data} />}
    </QueryBoundary>
  );
}
