'use client';

import { useState } from 'react';
import { PiggyBank, Plus } from 'lucide-react';
import { formatCentsForBrInput } from '@tim/domain';
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
import { createAccountAction } from '@/lib/api/mutations';

type Option = { id: string; name: string };

/** Cria caixinha já vinculada à conta pai (e ao banco, se houver). */
export function NewPotSheet({
  parentAccountId,
  parentAccountName,
  costCenterId,
  institutionId,
  triggerLabel = 'Reserva',
  compact = false,
  iconOnly = false,
}: {
  parentAccountId: string;
  parentAccountName: string;
  costCenterId: string;
  institutionId?: string | null;
  triggerLabel?: string;
  compact?: boolean;
  /** Só ícone — ideal em linhas densas no mobile. */
  iconOnly?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size={iconOnly ? 'icon-sm' : 'sm'}
          variant="ghost"
          title={iconOnly ? triggerLabel : undefined}
          aria-label={iconOnly ? triggerLabel : undefined}
        >
          {compact && !iconOnly ? (
            <Plus className="size-3.5" />
          ) : (
            <PiggyBank className="size-3.5" />
          )}
          {iconOnly ? null : triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nova reserva</SheetTitle>
          <SheetDescription>
            Opcional — caixinha ou reserva ligada a {parentAccountName} (comum em bancos digitais).
          </SheetDescription>
        </SheetHeader>
        <ActionForm
          action={createAccountAction}
          successMessage="Reserva criada"
          invalidate="settings"
          onSuccess={() => setOpen(false)}
          className="grid gap-3"
        >
          <input type="hidden" name="kind" value="investment_pot" />
          <input type="hidden" name="parentAccountId" value={parentAccountId} />
          <input type="hidden" name="costCenterId" value={costCenterId} />
          {institutionId ? (
            <input type="hidden" name="institutionId" value={institutionId} />
          ) : null}

          <div className="grid gap-1.5">
            <Label>Conta pai</Label>
            <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
              {parentAccountName}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`pot-name-${parentAccountId}`}>Nome</Label>
            <Input
              id={`pot-name-${parentAccountId}`}
              name="name"
              required
              placeholder="Reserva de emergência"
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`pot-balance-${parentAccountId}`}>Saldo atual (R$)</Label>
            <MoneyInput
              id={`pot-balance-${parentAccountId}`}
              name="balance"
              min="0"
              defaultValue={formatCentsForBrInput(0)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`pot-yield-type-${parentAccountId}`}>Rendimento</Label>
              <select
                id={`pot-yield-type-${parentAccountId}`}
                name="yieldType"
                className={nativeSelectClassName}
                defaultValue="cdi"
              >
                <option value="none">Sem rendimento</option>
                <option value="cdi">% do CDI</option>
                <option value="fixed_annual">Taxa fixa % a.a.</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`pot-yield-value-${parentAccountId}`}>Valor</Label>
              <MoneyInput
                id={`pot-yield-value-${parentAccountId}`}
                name="yieldValue"
                min="0"
                defaultValue="100"
                placeholder="100 = 100% CDI"
              />
            </div>
          </div>

          <SubmitButton pendingLabel="Criando…">Criar reserva</SubmitButton>
        </ActionForm>
      </SheetContent>
    </Sheet>
  );
}
