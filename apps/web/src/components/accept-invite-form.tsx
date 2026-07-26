'use client';

import { ActionForm } from '@/components/action-form';
import { SubmitButton } from '@/components/ui/submit-button';
import { acceptInviteAction } from '@/server/members-actions';

export function AcceptInviteForm({
  token,
  expectedEmail,
}: {
  token: string;
  expectedEmail: string;
}): React.ReactElement {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confirme com a conta do e-mail <strong>{expectedEmail}</strong>.
      </p>
      <ActionForm
        action={acceptInviteAction}
        successMessage="Convite aceito"
        loadingMessage="Aceitando…"
      >
        <input type="hidden" name="token" value={token} />
        <SubmitButton className="w-full" size="lg" pendingLabel="Aceitando…">
          Aceitar convite
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
