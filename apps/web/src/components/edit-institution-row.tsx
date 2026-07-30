'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
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
import { updateInstitutionAction } from '@/lib/api/mutations';

export function EditInstitutionRow({
  institutionId,
  name,
}: {
  institutionId: string;
  name: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" aria-label={`Renomear ${name}`}>
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Renomear banco</DialogTitle>
          <DialogDescription>O nome aparece nas contas e cartões deste banco.</DialogDescription>
        </DialogHeader>
        <ActionForm
          action={updateInstitutionAction}
          successMessage="Banco atualizado"
          loadingMessage="Salvando…"
          invalidate="settings"
          onSuccess={() => setOpen(false)}
          className="grid gap-3"
        >
          <input type="hidden" name="institutionId" value={institutionId} />
          <div className="grid gap-1.5">
            <Label htmlFor={`bank-name-${institutionId}`}>Nome</Label>
            <Input id={`bank-name-${institutionId}`} name="name" required defaultValue={name} />
          </div>
          <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
