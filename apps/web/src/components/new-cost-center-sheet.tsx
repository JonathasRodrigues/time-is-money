'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { CostCenterColorField } from '@/components/cost-center-color-field';
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
import { SubmitButton } from '@/components/ui/submit-button';
import { createCostCenterAction } from '@/lib/api/mutations';

export function NewCostCenterSheet(): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Building2 className="size-3.5" />
          Novo centro
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Novo centro de custo</SheetTitle>
          <SheetDescription>
            Separe PF, empresas e outros contextos. Escolha uma cor pronta ou personalize.
          </SheetDescription>
        </SheetHeader>
        <ActionForm
          action={createCostCenterAction}
          successMessage="Centro adicionado"
          invalidate="settings"
          onSuccess={() => setOpen(false)}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cost-center-name">Nome</Label>
            <Input id="cost-center-name" name="name" required placeholder="Ex.: Empresa X" />
          </div>
          <CostCenterColorField id="cost-center-color" />
          <SubmitButton pendingLabel="Adicionando…">Adicionar</SubmitButton>
        </ActionForm>
      </SheetContent>
    </Sheet>
  );
}
