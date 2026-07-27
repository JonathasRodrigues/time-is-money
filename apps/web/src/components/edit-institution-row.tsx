'use client';

import { ActionForm } from '@/components/action-form';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { updateInstitutionAction } from '@/server/actions';

export function EditInstitutionRow({
  institutionId,
  name,
}: {
  institutionId: string;
  name: string;
}): React.ReactElement {
  return (
    <ActionForm
      action={updateInstitutionAction}
      successMessage="Banco atualizado"
      loadingMessage="Salvando…"
      className="flex items-center gap-2"
    >
      <input type="hidden" name="institutionId" value={institutionId} />
      <Input
        name="name"
        required
        defaultValue={name}
        className="h-8 flex-1"
        aria-label="Nome do banco"
      />
      <SubmitButton size="sm" variant="outline" pendingLabel="…">
        Salvar
      </SubmitButton>
    </ActionForm>
  );
}
