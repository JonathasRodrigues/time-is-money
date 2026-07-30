'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { MEMBER_ROLE_LABEL } from '@tim/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { nativeSelectClassName } from '@/components/page-header';
import { useMutationFeedback } from '@/hooks/use-mutation-feedback';
import { inviteMemberAction } from '@/lib/api/mutations';

const ROLE_OPTIONS = ['viewer', 'editor', 'admin'] as const;

export function InviteMemberForm(): React.ReactElement {
  const { run } = useMutationFeedback();
  const [pending, setPending] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    void run(() => inviteMemberAction(formData), {
      loading: 'Convidando…',
      success: 'Convite registrado',
      invalidate: 'members',
    })
      .then((result) => {
        setLastInviteUrl(result.inviteUrl);
      })
      .catch(() => {
        // toast handled in run
      })
      .finally(() => {
        setPending(false);
      });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="invite-email">E-mail</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="pessoa@email.com"
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-role">Papel</Label>
          <select
            id="invite-role"
            name="role"
            className={nativeSelectClassName}
            defaultValue="viewer"
            disabled={pending}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {MEMBER_ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Convidando…' : 'Enviar convite'}
        </Button>
      </form>

      {lastInviteUrl ? (
        <div className="rounded-xl border bg-muted/40 p-3 text-sm">
          <p className="mb-1 font-medium">Link do convite</p>
          <p className="break-all text-muted-foreground">{lastInviteUrl}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(lastInviteUrl);
              toast.success('Link copiado');
            }}
          >
            Copiar link
          </Button>
        </div>
      ) : null}
    </div>
  );
}
