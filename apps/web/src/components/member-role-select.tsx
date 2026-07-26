'use client';

import { MEMBER_ROLE_LABEL } from '@tim/domain';
import type { Role } from '@tim/permissions';
import { ActionForm } from '@/components/action-form';
import { nativeSelectClassName } from '@/components/page-header';
import { updateMemberRoleAction } from '@/server/members-actions';

const ROLE_OPTIONS: Role[] = ['viewer', 'editor', 'admin'];

export function MemberRoleSelect({
  membershipId,
  role,
  disabled,
}: {
  membershipId: string;
  role: Role;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <ActionForm
      action={updateMemberRoleAction}
      successMessage="Papel atualizado"
      loadingMessage="Atualizando…"
      className="flex items-center gap-2"
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <select
        name="role"
        className={nativeSelectClassName}
        defaultValue={role}
        disabled={disabled}
        onChange={(event) => {
          if (!disabled) {
            event.currentTarget.form?.requestSubmit();
          }
        }}
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {MEMBER_ROLE_LABEL[option]}
          </option>
        ))}
      </select>
    </ActionForm>
  );
}
