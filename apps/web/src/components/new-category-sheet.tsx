'use client';

import { useState } from 'react';
import { FolderTree } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { nativeSelectClassName } from '@/components/page-header';
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
import { createCategoryAction } from '@/lib/api/mutations';

export function NewCategorySheet(): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FolderTree className="size-3.5" />
          Nova categoria
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nova categoria</SheetTitle>
          <SheetDescription>
            Além do seed padrão — use em lançamentos, contas a pagar e a receber.
          </SheetDescription>
        </SheetHeader>
        <ActionForm
          action={createCategoryAction}
          successMessage="Categoria adicionada"
          invalidate="settings"
          onSuccess={() => setOpen(false)}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="category-name">Nome</Label>
            <Input id="category-name" name="name" required placeholder="Ex.: Assinaturas" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="category-type">Tipo</Label>
            <select
              id="category-type"
              name="type"
              className={nativeSelectClassName}
              defaultValue="expense"
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>
          <SubmitButton pendingLabel="Adicionando…">Adicionar</SubmitButton>
        </ActionForm>
      </SheetContent>
    </Sheet>
  );
}
