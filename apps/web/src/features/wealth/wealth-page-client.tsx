'use client';

import { useQuery } from '@tanstack/react-query';
import type { WealthResponse } from '@tim/api-contract';
import {
  ACCOUNT_KIND_LABEL,
  formatBrlFromCents,
  formatIsoDateBr,
  formatTransferRouteLabel,
  type AccountKind,
} from '@tim/domain';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { BankLogo } from '@/components/bank-logo';
import { PayCreditCardInvoiceLink } from '@/components/pay-credit-card-invoice-link';
import { QueryBoundary } from '@/components/query-boundary';
import { CardsPageSkeleton } from '@/components/page-skeletons';
import { TransferSheet } from '@/components/transfer-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';

function WealthContent({ data }: { data: WealthResponse }): React.ReactElement {
  const { summary, bankGroups, transfers, transferForm, isEmpty } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patrimônio"
        description="Ativos (contas e caixinhas) menos passivos (faturas de cartão)."
        actions={
          <>
            <TransferSheet
              accounts={transferForm.accounts}
              defaultFromId={transferForm.defaultFromId}
              defaultToId={transferForm.defaultToId}
              today={transferForm.today}
            />
            <Button asChild variant="outline" size="sm">
              <Link href="/cadastros/accounts">Gerenciar contas</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm sm:col-span-2 xl:col-span-1">
          <p className="text-xs text-muted-foreground">Patrimônio líquido</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
            {formatBrlFromCents(summary.netCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Ativos</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(summary.assetsCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Passivos (faturas)</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(summary.liabilitiesCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Líquido (conta / dinheiro)</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(summary.liquidCents)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Rend. mensal estimado*</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
            {formatBrlFromCents(summary.monthlyYieldCents)}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        *Estimativa simples (CDI ref. 13,15% a.a.). Transferências movem saldo entre contas sem
        contar como receita ou despesa. Pagamento de fatura reduz ativo e passivo.
      </p>

      {bankGroups.map((group) => (
        <Card key={group.bankId} className="gap-4 py-5">
          <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
            <div className="flex min-w-0 items-start gap-3">
              <BankLogo name={group.bankName} size="md" />
              <div className="min-w-0">
                <CardTitle>{group.bankName}</CardTitle>
                <CardDescription>
                  {group.accounts.length} conta{group.accounts.length === 1 ? '' : 's'} ·{' '}
                  {formatBrlFromCents(group.bankTotalCents)}
                  {group.creditCards.length > 0
                    ? ` · ${group.creditCards.length} cartão${group.creditCards.length === 1 ? '' : 'ões'}`
                    : ''}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y px-5">
            {group.accounts.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.name}</p>
                    <Badge variant="outline">{ACCOUNT_KIND_LABEL[row.kind as AccountKind]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.costCenterName}
                    {row.parentName ? ` · dentro de ${row.parentName}` : ''}
                    {' · '}
                    {row.yieldLabel}
                    {row.monthlyYieldCents > 0
                      ? ` · ~${formatBrlFromCents(row.monthlyYieldCents)}/mês`
                      : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {formatBrlFromCents(row.balanceCents)}
                </p>
              </div>
            ))}
            {group.creditCards.map((card) => {
              const showCredit = card.cardMode !== 'debit';
              return (
                <div
                  key={card.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{card.name}</p>
                      <Badge variant="secondary">
                        {card.cardMode === 'debit'
                          ? 'Débito'
                          : card.cardMode === 'credit'
                            ? 'Crédito'
                            : 'Crédito e débito'}
                      </Badge>
                      {card.lastFour ? (
                        <span className="text-xs text-muted-foreground">•••• {card.lastFour}</span>
                      ) : null}
                    </div>
                    {showCredit ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Fatura {formatBrlFromCents(card.invoiceBalanceCents)} · disponível{' '}
                          {formatBrlFromCents(card.availableCents)} · fecha {card.closingDay} /
                          vence {card.dueDay}
                        </p>
                        <PayCreditCardInvoiceLink
                          creditCardId={card.id}
                          invoiceBalanceCents={card.invoiceBalanceCents}
                        />
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Só débito — sem fatura.</p>
                    )}
                  </div>
                  {showCredit ? (
                    <p className="text-sm font-semibold tabular-nums text-destructive">
                      −{formatBrlFromCents(card.invoiceBalanceCents)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {transfers.length > 0 ? (
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Transferências recentes</CardTitle>
            <CardDescription>Últimos movimentos internos de patrimônio.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y px-5">
            {transfers.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {formatTransferRouteLabel(row.fromName, row.toName)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatIsoDateBr(row.occurredOn)}
                    {row.description ? ` · ${row.description}` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {formatBrlFromCents(row.amountCents)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {isEmpty ? (
        <Card className="gap-4 py-5">
          <CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma conta ainda.{' '}
            <Link
              href="/cadastros/accounts"
              className="text-primary underline-offset-4 hover:underline"
            >
              Cadastre bancos e caixinhas
            </Link>
            .
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function WealthPageClient(): React.ReactElement {
  const query = useQuery({
    queryKey: queryKeys.wealth(),
    queryFn: () => api.wealth.get(),
  });

  return (
    <QueryBoundary query={query} skeleton={<CardsPageSkeleton />}>
      {(data) => <WealthContent data={data} />}
    </QueryBoundary>
  );
}
