export const dynamic = 'force-dynamic';

import { categories } from '@tim/db';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { PageHeader, nativeSelectClassName } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
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
import { createCategoryAction } from '@/server/actions';
import { getAuthSession, getDb } from '@/server/db';

export default async function CategoriesSettingsPage(): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');
  const db = getDb();
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.householdId, session.householdId));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Categorias" description="Receitas e despesas do household." />
      <Card>
        <CardHeader>
          <CardTitle>Nova categoria</CardTitle>
          <CardDescription>Adicione além do seed padrão</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createCategoryAction}
            successMessage="Categoria adicionada"
            className="grid gap-3 md:grid-cols-[1fr_10rem_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Tipo</Label>
              <select id="type" name="type" className={nativeSelectClassName}>
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </div>
            <div className="flex items-end">
              <SubmitButton pendingLabel="Adicionando…">Adicionar</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>{rows.length} categorias</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.type === 'income' ? 'receita' : 'despesa'}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.isSystem ? 'seed' : 'custom'}
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
