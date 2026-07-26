'use server';

import {
  acceptHouseholdInvite,
  acceptHouseholdInviteById,
  createHouseholdInvite,
  removeMember,
  revokeHouseholdInvite,
  updateMemberRole,
} from '@tim/application';
import { households } from '@tim/db';
import { MEMBER_ROLE_LABEL } from '@tim/domain';
import { sendHouseholdInviteEmail } from '@tim/email';
import { requireCapability, requireSession } from '@tim/auth';
import {
  acceptHouseholdInviteSchema,
  createHouseholdInviteSchema,
  removeMemberSchema,
  revokeHouseholdInviteSchema,
  updateMemberRoleSchema,
} from '@tim/validators';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAppContext } from '@/server/context';
import { getAuthSession, getDb } from '@/server/db';

function revalidateMembers(): void {
  revalidatePath('/settings/members');
  revalidatePath('/', 'layout');
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export async function inviteMemberAction(formData: FormData): Promise<{
  inviteUrl: string;
  emailSent: boolean;
}> {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');

  const parsed = createHouseholdInviteSchema.parse({
    email: String(formData.get('email') ?? ''),
    role: String(formData.get('role') || 'viewer'),
  });

  const invite = await createHouseholdInvite(ctx, parsed);
  const inviteUrl = `${appBaseUrl()}/invite/${invite.token}`;

  let emailSent = false;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (apiKey && from) {
    const db = getDb();
    const [household] = await db
      .select({ name: households.name })
      .from(households)
      .where(eq(households.id, session.householdId))
      .limit(1);

    await sendHouseholdInviteEmail({
      apiKey,
      from,
      to: invite.email,
      inviterName: session.email?.split('@')[0] ?? 'Um admin',
      householdName: household?.name ?? 'seu household',
      roleLabel: MEMBER_ROLE_LABEL[invite.role],
      inviteUrl,
    });
    emailSent = true;
  }

  revalidateMembers();
  return { inviteUrl, emailSent };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');

  const parsed = revokeHouseholdInviteSchema.parse({
    invitationId: String(formData.get('invitationId') ?? ''),
  });
  await revokeHouseholdInvite(ctx, parsed);
  revalidateMembers();
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');

  const parsed = updateMemberRoleSchema.parse({
    membershipId: String(formData.get('membershipId') ?? ''),
    role: String(formData.get('role') ?? ''),
  });
  await updateMemberRole(ctx, parsed);
  revalidateMembers();
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');

  const parsed = removeMemberSchema.parse({
    membershipId: String(formData.get('membershipId') ?? ''),
  });
  await removeMember(ctx, parsed);
  revalidateMembers();
}

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const session = await getAuthSession();
  if (!session?.userId) {
    throw new Error('Não autenticado');
  }

  const parsed = acceptHouseholdInviteSchema.parse({
    token: String(formData.get('token') ?? ''),
  });

  const ctx = await createAppContext();
  await acceptHouseholdInvite(ctx, {
    token: parsed.token,
    userId: session.userId,
    email: session.email,
  });

  revalidateMembers();
  redirect('/dashboard');
}

export async function acceptInviteByIdAction(formData: FormData): Promise<void> {
  const session = await getAuthSession();
  if (!session?.userId) {
    throw new Error('Não autenticado');
  }

  const invitationId = String(formData.get('invitationId') ?? '');
  if (!invitationId) throw new Error('Convite inválido');

  const ctx = await createAppContext();
  await acceptHouseholdInviteById(ctx, {
    invitationId,
    userId: session.userId,
    email: session.email,
  });

  revalidateMembers();
  redirect('/dashboard');
}
