'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { nativeSelectClassName } from '@/components/page-header';
import { createTransactionAction } from '@/server/actions';
import { cn } from '@/lib/utils';

export function NewTransactionSheet({
  centers,
  categories,
  accounts,
  defaultCostCenterId,
  defaultOccurredOn,
}: {
  centers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: string }>;
  accounts: Array<{ id: string; name: string }>;
  defaultCostCenterId?: string;
  defaultOccurredOn: string;
}): React.ReactElement {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  const isExpense = type === 'expense';
  const isPaid = status === 'paid';

  const dateLabel = isPaid
    ? isExpense
      ? 'Data do pagamento'
      : 'Data do recebimento'
    : 'Data de vencimento';

  const dateHint = isPaid
    ? isExpense
      ? 'Quando o dinheiro saiu da conta.'
      : 'Quando o dinheiro entrou na conta.'
    : isExpense
      ? 'Quando a conta vence — entra em Contas a pagar.'
      : 'Quando você espera receber — fica a receber.';

  const statusPaidLabel = isExpense ? 'Já paguei' : 'Já recebi';
  const statusPendingLabel = isExpense ? 'Ainda não paguei' : 'Ainda não recebi';

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Novo
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registrar movimento</SheetTitle>
          <SheetDescription>
            Avulso no extrato. Contas fixas mensais ficam em Contas a pagar.
          </SheetDescription>
        </SheetHeader>
        <form action={createTransactionAction} className="mt-6 grid gap-4 px-4 pb-6">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="status" value={status} />

          <div className="grid gap-2">
            <Label>Tipo</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={type}
              onValueChange={(value) => {
                if (value === 'expense' || value === 'income') setType(value);
              }}
              className="w-full bg-muted/50"
            >
              <ToggleGroupItem value="expense" className="flex-1">
                Despesa
              </ToggleGroupItem>
              <ToggleGroupItem value="income" className="flex-1">
                Receita
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid gap-2">
            <Label>Situação</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={status}
              onValueChange={(value) => {
                if (value === 'paid' || value === 'pending') setStatus(value);
              }}
              className="w-full bg-muted/50"
            >
              <ToggleGroupItem value="paid" className="flex-1 px-2 text-xs sm:text-sm">
                {statusPaidLabel}
              </ToggleGroupItem>
              <ToggleGroupItem value="pending" className="flex-1 px-2 text-xs sm:text-sm">
                {statusPendingLabel}
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {isPaid
                ? 'Entra no extrato como concluído.'
                : 'Fica pendente até você confirmar / pagar.'}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-amount">Valor (R$)</Label>
            <Input id="new-amount" name="amount" type="number" step="0.01" min="0.01" required />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-date">{dateLabel}</Label>
            <Input
              id="new-date"
              name="date"
              type="date"
              required
              defaultValue={defaultOccurredOn}
            />
            <p className={cn('text-xs text-muted-foreground')}>{dateHint}</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-description">Descrição</Label>
            <Input id="new-description" name="description" placeholder="Opcional" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-costCenterId">Centro de custo</Label>
            <select
              id="new-costCenterId"
              name="costCenterId"
              className={nativeSelectClassName}
              required
              defaultValue={defaultCostCenterId ?? centers[0]?.id}
            >
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-categoryId">Categoria</Label>
            <select
              id="new-categoryId"
              name="categoryId"
              className={nativeSelectClassName}
              required
              key={type}
              defaultValue={filteredCategories[0]?.id}
            >
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-accountId">Conta</Label>
            <select
              id="new-accountId"
              name="accountId"
              className={nativeSelectClassName}
              required
              defaultValue={accounts[0]?.id}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new-notes">Notas (criptografadas)</Label>
            <Input id="new-notes" name="notes" />
          </div>

          <Button type="submit" className="mt-2">
            {isPaid ? 'Salvar no extrato' : isExpense ? 'Adicionar a pagar' : 'Adicionar a receber'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
