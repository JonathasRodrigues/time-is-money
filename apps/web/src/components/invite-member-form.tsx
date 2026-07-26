'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MEMBER_ROLE_LABEL } from '@tim/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { nativeSelectClassName } from '@/components/page-header';
import { inviteMemberAction } from '@/server/members-actions';

const ROLE_OPTIONS = ['viewer', 'editor', 'admin'] as const;

export function InviteMemberForm(): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  function onSubmit(formData: FormData): void {
    startTransition(async () => {
      try {
        const result = await inviteMemberAction(formData);
        setLastInviteUrl(result.inviteUrl);
        toast.success(
          result.emailSent
            ? 'Convite enviado por e-mail'
            : 'Convite criado — copie o link (e-mail não configurado)',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao convidar';
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <form action={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
        <div className="flex w-full flex-col gap-1.5 sm:w-44">
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
          {pending ? 'Convidando…' : 'Convidar'}
        </Button>
      </form>

      {lastInviteUrl ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
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
