'use client';

import { useState } from 'react';
import type { AccountKind, YieldType } from '@tim/domain';
import { Pencil } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { nativeSelectClassName } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { updateAccountAction } from '@/server/actions';

interface Option {
  id: string;
  name: string;
}

export function EditAccountDialog({
  account,
  centers,
  banks,
  parentOptions,
}: {
  account: {
    id: string;
    name: string;
    kind: AccountKind;
    costCenterId: string;
    institutionId: string | null;
    parentAccountId: string | null;
    balanceCents: number;
    yieldType: YieldType;
    yieldBps: number | null;
  };
  centers: Option[];
  banks: Option[];
  parentOptions: Option[];
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const yieldValue =
    account.yieldType !== 'none' && account.yieldBps != null
      ? (account.yieldBps / 100).toFixed(2)
      : '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Pencil className="size-3.5" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar conta</DialogTitle>
          <DialogDescription>
            Altere nome, banco, centro, tipo, saldo e rendimento.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={async (formData) => {
            await updateAccountAction(formData);
            setOpen(false);
          }}
          successMessage="Conta atualizada"
          loadingMessage="Salvando…"
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="accountId" value={account.id} />
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={`edit-name-${account.id}`}>Nome</Label>
            <Input
              id={`edit-name-${account.id}`}
              name="name"
              required
              defaultValue={account.name}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-kind-${account.id}`}>Tipo</Label>
            <select
              id={`edit-kind-${account.id}`}
              name="kind"
              className={nativeSelectClassName}
              defaultValue={account.kind}
            >
              <option value="checking">Conta corrente</option>
              <option value="cash">Dinheiro</option>
              <option value="investment_pot">Investimento / caixinha</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-bank-${account.id}`}>Banco</Label>
            <select
              id={`edit-bank-${account.id}`}
              name="institutionId"
              className={nativeSelectClassName}
              defaultValue={account.institutionId ?? ''}
            >
              <option value="">—</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-center-${account.id}`}>Centro</Label>
            <select
              id={`edit-center-${account.id}`}
              name="costCenterId"
              className={nativeSelectClassName}
              required
              defaultValue={account.costCenterId}
            >
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-parent-${account.id}`}>Conta pai (caixinha)</Label>
            <select
              id={`edit-parent-${account.id}`}
              name="parentAccountId"
              className={nativeSelectClassName}
              defaultValue={account.parentAccountId ?? ''}
            >
              <option value="">—</option>
              {parentOptions
                .filter((option) => option.id !== account.id)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-balance-${account.id}`}>Saldo atual (R$)</Label>
            <Input
              id={`edit-balance-${account.id}`}
              name="balance"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(account.balanceCents / 100).toFixed(2)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-yield-type-${account.id}`}>Rendimento</Label>
            <select
              id={`edit-yield-type-${account.id}`}
              name="yieldType"
              className={nativeSelectClassName}
              defaultValue={account.yieldType}
            >
              <option value="none">Sem rendimento</option>
              <option value="cdi">% do CDI</option>
              <option value="fixed_annual">Taxa fixa % a.a.</option>
            </select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={`edit-yield-value-${account.id}`}>Valor do rendimento</Label>
            <Input
              id={`edit-yield-value-${account.id}`}
              name="yieldValue"
              type="number"
              step="0.01"
              min="0"
              defaultValue={yieldValue}
              placeholder="100 = 100% CDI · 13,15 = 13,15% a.a."
            />
          </div>
          <SubmitButton className="sm:col-span-2" pendingLabel="Salvando…">
            Salvar alterações
          </SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
