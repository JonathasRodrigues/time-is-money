'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MembersResponse } from '@tim/api-contract';
import { MEMBER_ROLE_LABEL } from '@tim/domain';
import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { InviteMemberSheet } from '@/components/invite-member-sheet';
import { MemberRoleSelect } from '@/components/member-role-select';
import { PageHeader } from '@/components/page-header';
import { QueryBoundary } from '@/components/query-boundary';
import { PageSkeleton } from '@/components/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMe } from '@/features/session/hooks';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';
import { removeMemberAction, revokeInviteAction } from '@/lib/api/mutations';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

type MemberRow = MembersResponse['members'][number];
type InviteRow = MembersResponse['invites'][number];

function MemberListRow({ member }: { member: MemberRow }): React.ReactElement {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium tracking-tight">{member.email ?? member.userId}</p>
          {member.isSelf ? (
            <Badge variant="secondary" className="font-normal">
              Você
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">Desde {formatDate(member.createdAt)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MemberRoleSelect membershipId={member.id} role={member.role} disabled={member.isSelf} />
        {member.isSelf ? null : (
          <ActionForm
            action={removeMemberAction}
            successMessage="Membro removido"
            loadingMessage="Removendo…"
            invalidate="members"
          >
            <input type="hidden" name="membershipId" value={member.id} />
            <Button type="submit" variant="ghost" size="sm">
              Remover
            </Button>
          </ActionForm>
        )}
      </div>
    </div>
  );
}

function InviteListRow({ invite }: { invite: InviteRow }): React.ReactElement {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0 space-y-1.5">
        <p className="truncate font-medium tracking-tight">{invite.email}</p>
        <p className="text-xs text-muted-foreground">
          {MEMBER_ROLE_LABEL[invite.role]} · expira {formatDate(invite.expiresAt)}
        </p>
      </div>
      <ActionForm
        action={revokeInviteAction}
        successMessage="Convite cancelado"
        loadingMessage="Cancelando…"
        invalidate="members"
      >
        <input type="hidden" name="invitationId" value={invite.id} />
        <Button type="submit" variant="ghost" size="sm">
          Cancelar
        </Button>
      </ActionForm>
    </div>
  );
}

function MembersContent({ data }: { data: MembersResponse }): React.ReactElement {
  const { members, invites } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Família"
        description="Convide pessoas para o household e defina o papel de cada uma."
        actions={<InviteMemberSheet />}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Membros</CardTitle>
            <CardDescription>
              {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'} neste household
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="divide-y px-0">
          {members.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
                <Users className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum membro listado.</p>
            </div>
          ) : (
            members.map((member) => <MemberListRow key={member.id} member={member} />)
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Convites pendentes</CardTitle>
            <CardDescription>
              {invites.length === 0
                ? 'Nenhum convite aguardando aceite'
                : `${invites.length} ${invites.length === 1 ? 'convite aberto' : 'convites abertos'}`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="divide-y px-0">
          {invites.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Convide alguém pelo botão no topo da página.
            </p>
          ) : (
            invites.map((invite) => <InviteListRow key={invite.id} invite={invite} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MembersPageClient(): React.ReactElement {
  const router = useRouter();
  const meQuery = useMe();

  useEffect(() => {
    if (meQuery.data && !meQuery.data.canManageMembers) {
      router.replace('/settings/preferences');
    }
  }, [meQuery.data, router]);

  const membersQuery = useQuery({
    queryKey: queryKeys.members(),
    queryFn: () => api.members.list(),
    enabled: meQuery.data?.canManageMembers === true,
  });

  if (meQuery.isPending) {
    return <PageSkeleton showActions showTable={false} kpiCount={0} />;
  }

  if (!meQuery.data?.canManageMembers) {
    return <></>;
  }

  return (
    <QueryBoundary
      query={membersQuery}
      skeleton={<PageSkeleton showActions showTable={false} kpiCount={0} />}
    >
      {(data) => <MembersContent data={data} />}
    </QueryBoundary>
  );
}
