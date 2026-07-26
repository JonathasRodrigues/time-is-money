export const dynamic = 'force-dynamic';

import {
  ACCOUNT_KIND_LABEL,
  formatBrlFromCents,
  formatYieldLabel,
  YIELD_TYPE_LABEL,
  type AccountKind,
  type YieldType,
} from '@tim/domain';
import { accounts, costCenters, institutions } from '@tim/db';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { PageHeader, nativeSelectClassName } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createAccountAction,
  createInstitutionAction,
  updateAccountBalanceAction,
} from '@/server/actions';
import { getAuthSession, getDb } from '@/server/db';

export default async function AccountsSettingsPage(): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');
  const db = getDb();
  const [centers, banks, rows] = await Promise.all([
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(institutions).where(eq(institutions.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
  ]);
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const bankMap = new Map(banks.map((b) => [b.id, b.name]));
  const parents = rows.filter((r) => r.kind !== 'investment_pot');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bancos e contas"
        description="Instituições, contas correntes e caixinhas / investimentos."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Novo banco</CardTitle>
            <CardDescription>Ex.: Nubank, Itaú, Inter</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <form action={createInstitutionAction} className="flex flex-wrap items-end gap-3">
              <div className="grid min-w-[12rem] flex-1 gap-1.5">
                <Label htmlFor="bank-name">Nome</Label>
                <Input id="bank-name" name="name" required placeholder="Nubank" />
              </div>
              <Button type="submit">Adicionar banco</Button>
            </form>
            {banks.length > 0 ? (
              <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                {banks.map((bank) => (
                  <li key={bank.id}>{bank.name}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle>Nova conta / caixinha</CardTitle>
            <CardDescription>
              Conta corrente, dinheiro ou investimento. Caixinhas podem ter rendimento % CDI.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <form action={createAccountAction} className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" required placeholder="Caixinha Reserva" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="kind">Tipo</Label>
                <select
                  id="kind"
                  name="kind"
                  className={nativeSelectClassName}
                  defaultValue="checking"
                >
                  <option value="checking">Conta corrente</option>
                  <option value="cash">Dinheiro</option>
                  <option value="investment_pot">Investimento / caixinha</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="institutionId">Banco</Label>
                <select id="institutionId" name="institutionId" className={nativeSelectClassName}>
                  <option value="">—</option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="costCenterId">Centro</Label>
                <select
                  id="costCenterId"
                  name="costCenterId"
                  className={nativeSelectClassName}
                  required
                >
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="parentAccountId">Conta pai (caixinha)</Label>
                <select
                  id="parentAccountId"
                  name="parentAccountId"
                  className={nativeSelectClassName}
                >
                  <option value="">—</option>
                  {parents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="balance">Saldo atual (R$)</Label>
                <Input
                  id="balance"
                  name="balance"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="yieldType">Rendimento</Label>
                <select
                  id="yieldType"
                  name="yieldType"
                  className={nativeSelectClassName}
                  defaultValue="none"
                >
                  <option value="none">Sem rendimento</option>
                  <option value="cdi">% do CDI</option>
                  <option value="fixed_annual">Taxa fixa % a.a.</option>
                </select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="yieldValue">Valor do rendimento</Label>
                <Input
                  id="yieldValue"
                  name="yieldValue"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="100 = 100% CDI · 13,15 = 13,15% a.a."
                />
              </div>
              <Button type="submit" className="sm:col-span-2">
                Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-4 py-5">
        <CardHeader className="px-5 pb-0">
          <CardTitle>Lista</CardTitle>
          <CardDescription>{rows.length} contas · saldos informados manualmente</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Rendimento</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Atualizar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.institutionId ? bankMap.get(row.institutionId) : '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ACCOUNT_KIND_LABEL[row.kind as AccountKind]}</Badge>
                  </TableCell>
                  <TableCell>{centerMap.get(row.costCenterId) ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatYieldLabel(row.yieldType as YieldType, row.yieldBps)}
                    <span className="sr-only">{YIELD_TYPE_LABEL[row.yieldType as YieldType]}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBrlFromCents(row.balanceCents)}
                  </TableCell>
                  <TableCell>
                    <form
                      action={updateAccountBalanceAction}
                      className="flex items-center justify-end gap-1"
                    >
                      <input type="hidden" name="accountId" value={row.id} />
                      <Input
                        name="balance"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={(row.balanceCents / 100).toFixed(2)}
                        className="h-8 w-28"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        OK
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
