export const dynamic = 'force-dynamic';

import { costCenters } from '@tim/db';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { CostCenterColorField, CostCenterColorSwatch } from '@/components/cost-center-color-field';
import { ActionForm } from '@/components/action-form';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createCostCenterAction } from '@/server/actions';
import { getAuthSession, getDb } from '@/server/db';

export default async function CostCentersPage(): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');
  const rows = await getDb()
    .select()
    .from(costCenters)
    .where(eq(costCenters.householdId, session.householdId));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Centros de custo" description="Separe PF, empresas e outros contextos." />
      <Card>
        <CardHeader>
          <CardTitle>Novo centro</CardTitle>
          <CardDescription>Escolha uma cor pronta ou personalize no seletor.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createCostCenterAction}
            successMessage="Centro adicionado"
            className="grid gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="Empresa X" required />
              </div>
              <SubmitButton className="sm:mb-0.5" pendingLabel="Adicionando…">
                Adicionar
              </SubmitButton>
            </div>
            <CostCenterColorField />
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>{rows.length} centros</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <CostCenterColorSwatch color={row.color} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.isSystem ? 'seed' : 'custom'}</Badge>
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
