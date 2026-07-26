export const dynamic = 'force-dynamic';

import { can } from '@tim/auth';
import { MEMBER_ROLE_LABEL } from '@tim/domain';
import { listHouseholdMembers, listPendingHouseholdInvites } from '@tim/application';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { InviteMemberForm } from '@/components/invite-member-form';
import { MemberRoleSelect } from '@/components/member-role-select';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createAppContext } from '@/server/context';
import { getAuthSession } from '@/server/db';
import { removeMemberAction, revokeInviteAction } from '@/server/members-actions';

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

export default async function MembersPage(): Promise<React.ReactElement> {
  const session = await getAuthSession();
  if (!session?.householdId) redirect('/onboarding');
  if (!can(session, 'members.manage')) redirect('/settings/preferences');

  const ctx = await createAppContext();
  const [members, invites] = await Promise.all([
    listHouseholdMembers(ctx),
    listPendingHouseholdInvites(ctx),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Família"
        description="Convide pessoas para o household e defina o papel de cada uma."
      />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Convidar</CardTitle>
          <CardDescription>
            Envia e-mail quando o Resend estiver configurado. Sem isso, use o link gerado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteMemberForm />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Membros</CardTitle>
          <CardDescription>{members.length} pessoa(s) neste household</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.userId === session.userId;
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{member.email ?? member.userId}</span>
                        {isSelf ? (
                          <Badge variant="secondary" className="w-fit">
                            Você
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <MemberRoleSelect
                        membershipId={member.id}
                        role={member.role}
                        disabled={isSelf}
                      />
                    </TableCell>
                    <TableCell>{formatDate(member.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <ActionForm
                          action={removeMemberAction}
                          successMessage="Membro removido"
                          loadingMessage="Removendo…"
                        >
                          <input type="hidden" name="membershipId" value={member.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Remover
                          </Button>
                        </ActionForm>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Convites pendentes</CardTitle>
          <CardDescription>
            {invites.length === 0
              ? 'Nenhum convite aguardando aceite'
              : `${invites.length} convite(s) aberto(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? null : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>{MEMBER_ROLE_LABEL[invite.role]}</TableCell>
                    <TableCell>{formatDate(invite.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      <ActionForm
                        action={revokeInviteAction}
                        successMessage="Convite cancelado"
                        loadingMessage="Cancelando…"
                      >
                        <input type="hidden" name="invitationId" value={invite.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Cancelar
                        </Button>
                      </ActionForm>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
