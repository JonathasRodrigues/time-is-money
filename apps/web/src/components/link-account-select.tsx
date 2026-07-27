'use client';

import { Plus } from 'lucide-react';
import { nativeSelectClassName } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Option {
  id: string;
  name: string;
}

interface LinkAccountSelectProps {
  accounts: Option[];
  centers: Option[];
  value: string;
  onValueChange: (value: string) => void;
  createNew: boolean;
  onCreateNewChange: (value: boolean) => void;
  newAccountName: string;
  onNewAccountNameChange: (value: string) => void;
  newAccountCostCenterId: string;
  onNewAccountCostCenterIdChange: (value: string) => void;
}

export function LinkAccountSelect({
  accounts,
  centers,
  value,
  onValueChange,
  createNew,
  onCreateNewChange,
  newAccountName,
  onNewAccountNameChange,
  newAccountCostCenterId,
  onNewAccountCostCenterIdChange,
}: LinkAccountSelectProps): React.ReactElement {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Caixinha para guardar</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => onCreateNewChange(!createNew)}
        >
          <Plus className="size-3.5" />
          {createNew ? 'Usar existente' : 'Criar nova'}
        </Button>
      </div>

      {createNew ? (
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="linkedAccountName">Nome da caixinha</Label>
            <Input
              id="linkedAccountName"
              value={newAccountName}
              onChange={(event) => onNewAccountNameChange(event.target.value)}
              placeholder="Caixinha Viagem"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="linkedAccountCostCenterId">Centro de custo</Label>
            <select
              id="linkedAccountCostCenterId"
              className={nativeSelectClassName}
              value={newAccountCostCenterId}
              onChange={(event) => onNewAccountCostCenterIdChange(event.target.value)}
              required
            >
              <option value="">Selecione…</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="linkedAccountId">Caixinha</Label>
          <select
            id="linkedAccountId"
            className={nativeSelectClassName}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          >
            <option value="">Sem caixinha (só simulação)</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            O progresso usa o saldo da caixinha vinculada.
          </p>
        </div>
      )}
    </div>
  );
}
