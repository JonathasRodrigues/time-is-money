'use client';

import { useState } from 'react';
import type { AccountKind, InstantAccountPaymentRail, YieldType } from '@tim/domain';
import { formatCentsForBrInput } from '@tim/domain';
import { Pencil } from 'lucide-react';
import { AccountPaymentRailsFields } from '@/components/account-payment-rails-fields';
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
import { MoneyInput } from '@/components/ui/money-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { updateAccountAction } from '@/lib/api/mutations';

interface Option {
  id: string;
  name: string;
}

export function EditAccountDialog({
  account,
  centers,
  banks,
  parentOptions,
  iconOnly = false,
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
    allowedPaymentRails: InstantAccountPaymentRail[];
  };
  centers: Option[];
  banks: Option[];
  parentOptions: Option[];
  iconOnly?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const yieldValue =
    account.yieldType !== 'none' && account.yieldBps != null
      ? formatCentsForBrInput(account.yieldBps)
      : '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={iconOnly ? 'icon-sm' : 'sm'}
          variant="outline"
          title={iconOnly ? 'Editar' : undefined}
          aria-label={iconOnly ? 'Editar conta' : undefined}
        >
          <Pencil className="size-3.5" />
          {iconOnly ? null : 'Editar'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar conta</DialogTitle>
          <DialogDescription>
            Altere nome, banco, centro, tipo, saldo, rendimento e formas de pagamento.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={updateAccountAction}
          successMessage="Conta atualizada"
          loadingMessage="Salvando…"
          invalidate={['settings', 'money']}
          onSuccess={() => setOpen(false)}
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
              <option value="savings">Poupança</option>
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
            <MoneyInput
              id={`edit-balance-${account.id}`}
              name="balance"
              min="0"
              defaultValue={formatCentsForBrInput(account.balanceCents)}
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
            <MoneyInput
              id={`edit-yield-value-${account.id}`}
              name="yieldValue"
              min="0"
              defaultValue={yieldValue}
              placeholder="100 = 100% CDI · 13,15 = 13,15% a.a."
            />
          </div>
          <AccountPaymentRailsFields
            idPrefix={`edit-${account.id}`}
            defaultRails={account.allowedPaymentRails}
          />
          <SubmitButton className="sm:col-span-2" pendingLabel="Salvando…">
            Salvar alterações
          </SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
