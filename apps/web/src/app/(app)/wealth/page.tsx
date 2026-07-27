export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import {
  ACCOUNT_KIND_LABEL,
  estimateMonthlyYieldCents,
  formatBrlFromCents,
  formatIsoDateBr,
  formatTransferRouteLabel,
  formatYieldLabel,
  type AccountKind,
  type YieldType,
} from '@tim/domain';
import { accountTransfers, accounts, costCenters, institutions } from '@tim/db';
import { and, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader, nativeSelectClassName } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { CardsPageSkeleton } from '@/components/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { createTransferAction } from '@/server/actions';
import { getAuthSession, getDb } from '@/server/db';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function accountOptionLabel(row: { name: string; kind: string; balanceCents: number }): string {
  const kind =
    row.kind === 'investment_pot'
      ? 'caixinha'
      : (ACCOUNT_KIND_LABEL[row.kind as AccountKind] ?? row.kind);
  return `${row.name} (${kind}) · ${formatBrlFromCents(row.balanceCents)}`;
}

export default function WealthPage(): React.ReactElement {
  return (
    <Suspense fallback={<CardsPageSkeleton />}>
      <WealthView />
    </Suspense>
  );
}

async function WealthView(): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');
  const db = getDb();

  const [rows, banks, centers, transfers] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.householdId, session.householdId), eq(accounts.isArchived, false))),
    db.select().from(institutions).where(eq(institutions.householdId, session.householdId)),
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db
      .select()
      .from(accountTransfers)
      .where(eq(accountTransfers.householdId, session.householdId))
      .orderBy(desc(accountTransfers.occurredOn), desc(accountTransfers.createdAt))
      .limit(20),
  ]);

  const bankMap = new Map(banks.map((b) => [b.id, b.name]));
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const total = rows.reduce((sum, row) => sum + row.balanceCents, 0);
  const invested = rows
    .filter((row) => row.kind === 'investment_pot')
    .reduce((sum, row) => sum + row.balanceCents, 0);
  const liquid = total - invested;
  const monthlyYield = rows.reduce(
    (sum, row) =>
      sum +
      estimateMonthlyYieldCents({
        balanceCents: row.balanceCents,
        yieldType: row.yieldType as YieldType,
        yieldBps: row.yieldBps,
      }),
    0,
  );

  const byBank = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.institutionId ?? 'none';
    const list = byBank.get(key) ?? [];
    list.push(row);
    byBank.set(key, list);
  }

  const defaultFrom = rows.find((r) => r.kind === 'checking')?.id ?? rows[0]?.id ?? '';
  const defaultTo =
    rows.find((r) => r.kind === 'investment_pot' && r.id !== defaultFrom)?.id ??
    rows.find((r) => r.id !== defaultFrom)?.id ??
    '';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patrimônio"
        description="Bancos, contas e caixinhas com saldo e rendimento estimado."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/cadastros/accounts">Gerenciar contas</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">{formatBrlFromCents(total)}</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Líquido (conta / dinheiro)</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">{formatBrlFromCents(liquid)}</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Investido / caixinhas</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">
            {formatBrlFromCents(invested)}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Rend. mensal estimado*</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-primary">
            {formatBrlFromCents(monthlyYield)}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        *Estimativa simples (CDI ref. 13,15% a.a.). Transferências movem saldo entre contas sem
        contar como receita ou despesa.
      </p>

      {rows.length >= 2 ? (
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Transferir</CardTitle>
            <CardDescription>
              Entre contas, dinheiro e caixinhas — só ajusta patrimônio.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ActionForm
              action={createTransferAction}
              successMessage="Transferência feita"
              loadingMessage="Transferindo…"
              className="grid gap-3 md:grid-cols-2"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="fromAccountId">De</Label>
                <select
                  id="fromAccountId"
                  name="fromAccountId"
                  required
                  className={nativeSelectClassName}
                  defaultValue={defaultFrom}
                >
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {accountOptionLabel(row)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="toAccountId">Para</Label>
                <select
                  id="toAccountId"
                  name="toAccountId"
                  required
                  className={nativeSelectClassName}
                  defaultValue={defaultTo}
                >
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {accountOptionLabel(row)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="amount">Valor (R$)</Label>
                <MoneyInput id="amount" name="amount" min="0.01" required placeholder="100,00" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="occurredOn">Data</Label>
                <DateInput id="occurredOn" name="occurredOn" required defaultValue={todayIso()} />
              </div>
              <div className="grid gap-1.5 md:col-span-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input id="description" name="description" placeholder="Guardar na reserva" />
              </div>
              <SubmitButton className="md:col-span-2 md:w-fit" pendingLabel="Transferindo…">
                Confirmar transferência
              </SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      {Array.from(byBank.entries()).map(([bankId, list]) => {
        const bankName = bankId === 'none' ? 'Sem banco' : (bankMap.get(bankId) ?? 'Banco');
        const bankTotal = list.reduce((sum, row) => sum + row.balanceCents, 0);
        return (
          <Card key={bankId} className="gap-4 py-5">
            <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-0">
              <div>
                <CardTitle>{bankName}</CardTitle>
                <CardDescription>
                  {list.length} conta{list.length === 1 ? '' : 's'} ·{' '}
                  {formatBrlFromCents(bankTotal)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="divide-y px-5">
              {list.map((row) => {
                const parent = row.parentAccountId ? byId.get(row.parentAccountId) : null;
                const yieldMonth = estimateMonthlyYieldCents({
                  balanceCents: row.balanceCents,
                  yieldType: row.yieldType as YieldType,
                  yieldBps: row.yieldBps,
                });
                return (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{row.name}</p>
                        <Badge variant="outline">
                          {ACCOUNT_KIND_LABEL[row.kind as AccountKind]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {centerMap.get(row.costCenterId) ?? '—'}
                        {parent ? ` · dentro de ${parent.name}` : ''}
                        {' · '}
                        {formatYieldLabel(row.yieldType as YieldType, row.yieldBps)}
                        {yieldMonth > 0 ? ` · ~${formatBrlFromCents(yieldMonth)}/mês` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatBrlFromCents(row.balanceCents)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {transfers.length > 0 ? (
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Transferências recentes</CardTitle>
            <CardDescription>Últimos movimentos internos de patrimônio.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y px-5">
            {transfers.map((row) => {
              const fromName = byId.get(row.fromAccountId)?.name ?? 'Conta';
              const toName = byId.get(row.toAccountId)?.name ?? 'Conta';
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{formatTransferRouteLabel(fromName, toName)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatIsoDateBr(row.occurredOn)}
                      {row.description ? ` · ${row.description}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatBrlFromCents(row.amountCents)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 ? (
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
