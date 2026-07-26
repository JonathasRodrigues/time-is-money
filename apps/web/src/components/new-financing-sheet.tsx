'use client';

import { Plus } from 'lucide-react';
import { FinancingForm } from '@/components/financing-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function NewFinancingSheet({
  centers,
  accounts,
  defaultCostCenterId,
}: {
  centers: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  defaultCostCenterId?: string;
}): React.ReactElement {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Novo
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Novo financiamento</SheetTitle>
          <SheetDescription>
            Simule Price, SAC ou parcela fixa e grave só depois de confirmar o cronograma.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <FinancingForm
            centers={centers}
            accounts={accounts}
            defaultCostCenterId={defaultCostCenterId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
