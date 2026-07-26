import { requireCapability, requireSession } from '@tim/auth';
import type { Database } from '@tim/db';
import { auditLogs, householdInvitations, households, memberships, userPreferences } from '@tim/db';
import {
  emailsMatchForInvite,
  inviteExpiresAt,
  isInviteExpired,
  normalizeInviteEmail,
} from '@tim/domain';
import type { Role } from '@tim/permissions';
import type {
  AcceptHouseholdInviteInput,
  CreateHouseholdInviteInput,
  RemoveMemberInput,
  RevokeHouseholdInviteInput,
  UpdateMemberRoleInput,
} from '@tim/validators';
import {
  acceptHouseholdInviteSchema,
  createHouseholdInviteSchema,
  removeMemberSchema,
  revokeHouseholdInviteSchema,
  updateMemberRoleSchema,
} from '@tim/validators';
import { and, eq, ne } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';

/** Compatível com AppContext — evita import circular com index.ts. */
export interface MembersAppContext {
  db: Database;
  session: import('@tim/auth').AuthSession | null;
  encryptionSecret: string;
}

function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

async function writeMembersAudit(
  ctx: MembersAppContext,
  input: {
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const session = requireSession(ctx.session);
  await ctx.db.insert(auditLogs).values({
    householdId: session.householdId,
    userId: session.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    source: 'app',
    metadata: input.metadata ?? {},
  });
}

export interface HouseholdMemberRow {
  id: string;
  userId: string;
  email: string | null;
  role: Role;
  createdAt: Date;
}

export interface HouseholdInviteRow {
  id: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: Date;
  createdAt: Date;
}

export async function listHouseholdMembers(ctx: MembersAppContext): Promise<HouseholdMemberRow[]> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');

  const rows = await ctx.db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      email: memberships.email,
      role: memberships.role,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .where(eq(memberships.householdId, session.householdId));

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: row.email,
    role: row.role as Role,
    createdAt: row.createdAt,
  }));
}

export async function listPendingHouseholdInvites(
  ctx: MembersAppContext,
): Promise<HouseholdInviteRow[]> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');

  const rows = await ctx.db
    .select({
      id: householdInvitations.id,
      email: householdInvitations.email,
      role: householdInvitations.role,
      status: householdInvitations.status,
      expiresAt: householdInvitations.expiresAt,
      createdAt: householdInvitations.createdAt,
    })
    .from(householdInvitations)
    .where(
      and(
        eq(householdInvitations.householdId, session.householdId),
        eq(householdInvitations.status, 'pending'),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as Role,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }));
}

export async function createHouseholdInvite(
  ctx: MembersAppContext,
  raw: CreateHouseholdInviteInput,
): Promise<{ invitationId: string; email: string; role: Role; token: string; expiresAt: Date }> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');
  const input = createHouseholdInviteSchema.parse(raw);
  const email = normalizeInviteEmail(input.email);

  const existingMembers = await ctx.db
    .select({ id: memberships.id, email: memberships.email })
    .from(memberships)
    .where(eq(memberships.householdId, session.householdId));

  if (existingMembers.some((m) => m.email && normalizeInviteEmail(m.email) === email)) {
    throw new Error('Esta pessoa já é membro deste household');
  }

  const [pending] = await ctx.db
    .select({ id: householdInvitations.id })
    .from(householdInvitations)
    .where(
      and(
        eq(householdInvitations.householdId, session.householdId),
        eq(householdInvitations.email, email),
        eq(householdInvitations.status, 'pending'),
      ),
    )
    .limit(1);

  if (pending) {
    throw new Error('Já existe um convite pendente para este e-mail');
  }

  const token = createInviteToken();
  const expiresAt = inviteExpiresAt();

  const [row] = await ctx.db
    .insert(householdInvitations)
    .values({
      householdId: session.householdId,
      email,
      role: input.role,
      tokenHash: hashInviteToken(token),
      invitedByUserId: session.userId,
      status: 'pending',
      expiresAt,
    })
    .returning();

  if (!row) throw new Error('Falha ao criar convite');

  await writeMembersAudit(ctx, {
    action: 'invite',
    resourceType: 'household_invitation',
    resourceId: row.id,
    metadata: { email, role: input.role },
  });

  return {
    invitationId: row.id,
    email,
    role: input.role as Role,
    token,
    expiresAt,
  };
}

export async function revokeHouseholdInvite(
  ctx: MembersAppContext,
  raw: RevokeHouseholdInviteInput,
): Promise<void> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');
  const input = revokeHouseholdInviteSchema.parse(raw);

  const [invite] = await ctx.db
    .select()
    .from(householdInvitations)
    .where(
      and(
        eq(householdInvitations.id, input.invitationId),
        eq(householdInvitations.householdId, session.householdId),
      ),
    )
    .limit(1);

  if (!invite) throw new Error('Convite não encontrado');
  if (invite.status !== 'pending') throw new Error('Convite não está pendente');

  await ctx.db
    .update(householdInvitations)
    .set({ status: 'revoked' })
    .where(eq(householdInvitations.id, invite.id));

  await writeMembersAudit(ctx, {
    action: 'revoke',
    resourceType: 'household_invitation',
    resourceId: invite.id,
    metadata: { email: invite.email },
  });
}

export async function updateMemberRole(
  ctx: MembersAppContext,
  raw: UpdateMemberRoleInput,
): Promise<void> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');
  const input = updateMemberRoleSchema.parse(raw);

  const [member] = await ctx.db
    .select()
    .from(memberships)
    .where(
      and(eq(memberships.id, input.membershipId), eq(memberships.householdId, session.householdId)),
    )
    .limit(1);

  if (!member) throw new Error('Membro não encontrado');

  if (member.role === 'admin' && input.role !== 'admin') {
    await assertNotLastAdmin(ctx.db, session.householdId, member.id);
  }

  await ctx.db.update(memberships).set({ role: input.role }).where(eq(memberships.id, member.id));

  await writeMembersAudit(ctx, {
    action: 'update_role',
    resourceType: 'membership',
    resourceId: member.id,
    metadata: { from: member.role, to: input.role, userId: member.userId },
  });
}

export async function removeMember(ctx: MembersAppContext, raw: RemoveMemberInput): Promise<void> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'members.manage');
  const input = removeMemberSchema.parse(raw);

  const [member] = await ctx.db
    .select()
    .from(memberships)
    .where(
      and(eq(memberships.id, input.membershipId), eq(memberships.householdId, session.householdId)),
    )
    .limit(1);

  if (!member) throw new Error('Membro não encontrado');
  if (member.userId === session.userId) {
    throw new Error('Você não pode remover a si mesmo');
  }

  if (member.role === 'admin') {
    await assertNotLastAdmin(ctx.db, session.householdId, member.id);
  }

  await ctx.db.delete(memberships).where(eq(memberships.id, member.id));

  await writeMembersAudit(ctx, {
    action: 'remove',
    resourceType: 'membership',
    resourceId: member.id,
    metadata: { userId: member.userId, email: member.email, role: member.role },
  });
}

async function assertNotLastAdmin(
  db: Database,
  householdId: string,
  excludingMembershipId: string,
): Promise<void> {
  const otherAdmins = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.householdId, householdId),
        eq(memberships.role, 'admin'),
        ne(memberships.id, excludingMembershipId),
      ),
    )
    .limit(1);

  if (otherAdmins.length === 0) {
    throw new Error('O household precisa de pelo menos um admin');
  }
}

export interface PeekInviteResult {
  email: string;
  role: Role;
  householdName: string;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
}

export async function peekHouseholdInvite(
  db: Database,
  token: string,
): Promise<PeekInviteResult | null> {
  const parsed = acceptHouseholdInviteSchema.safeParse({ token });
  if (!parsed.success) return null;

  const [row] = await db
    .select({
      email: householdInvitations.email,
      role: householdInvitations.role,
      status: householdInvitations.status,
      expiresAt: householdInvitations.expiresAt,
      householdName: households.name,
    })
    .from(householdInvitations)
    .innerJoin(households, eq(households.id, householdInvitations.householdId))
    .where(eq(householdInvitations.tokenHash, hashInviteToken(parsed.data.token)))
    .limit(1);

  if (!row) return null;

  const status =
    row.status === 'pending' && isInviteExpired(row.expiresAt) ? 'expired' : row.status;

  return {
    email: row.email,
    role: row.role as Role,
    householdName: row.householdName,
    expiresAt: row.expiresAt,
    status,
  };
}

async function finalizeInviteAcceptance(
  ctx: MembersAppContext,
  invite: typeof householdInvitations.$inferSelect,
  userId: string,
  email: string | null,
): Promise<{ householdId: string; role: Role }> {
  if (!userId) throw new Error('Não autenticado');

  const [existing] = await ctx.db
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  if (existing) {
    throw new Error('Você já pertence a um household. Saia do atual antes de aceitar outro.');
  }

  if (invite.status === 'revoked') throw new Error('Este convite foi cancelado');
  if (invite.status === 'accepted') throw new Error('Este convite já foi aceito');
  if (isInviteExpired(invite.expiresAt)) throw new Error('Este convite expirou');

  if (!emailsMatchForInvite(invite.email, email)) {
    throw new Error(
      `Entre com a conta do e-mail convidado (${invite.email}) para aceitar o convite`,
    );
  }

  const [membership] = await ctx.db
    .insert(memberships)
    .values({
      householdId: invite.householdId,
      userId,
      email: normalizeInviteEmail(invite.email),
      role: invite.role,
    })
    .returning();

  if (!membership) throw new Error('Falha ao criar membership');

  await ctx.db.insert(userPreferences).values({
    householdId: invite.householdId,
    userId,
  });

  await ctx.db
    .update(householdInvitations)
    .set({ status: 'accepted', acceptedAt: new Date() })
    .where(eq(householdInvitations.id, invite.id));

  await ctx.db.insert(auditLogs).values({
    householdId: invite.householdId,
    userId,
    action: 'accept',
    resourceType: 'household_invitation',
    resourceId: invite.id,
    source: 'app',
    metadata: { role: invite.role, email: invite.email },
  });

  return { householdId: invite.householdId, role: invite.role as Role };
}

export async function acceptHouseholdInvite(
  ctx: MembersAppContext,
  raw: AcceptHouseholdInviteInput & { userId: string; email: string | null },
): Promise<{ householdId: string; role: Role }> {
  const input = acceptHouseholdInviteSchema.parse({ token: raw.token });

  const [invite] = await ctx.db
    .select()
    .from(householdInvitations)
    .where(eq(householdInvitations.tokenHash, hashInviteToken(input.token)))
    .limit(1);

  if (!invite) throw new Error('Convite inválido');

  return finalizeInviteAcceptance(ctx, invite, raw.userId, raw.email);
}

/** Aceite autenticado pelo id (onboarding), validando e-mail da sessão. */
export async function acceptHouseholdInviteById(
  ctx: MembersAppContext,
  input: { invitationId: string; userId: string; email: string | null },
): Promise<{ householdId: string; role: Role }> {
  const [invite] = await ctx.db
    .select()
    .from(householdInvitations)
    .where(eq(householdInvitations.id, input.invitationId))
    .limit(1);

  if (!invite) throw new Error('Convite inválido');

  return finalizeInviteAcceptance(ctx, invite, input.userId, input.email);
}

/** Lista convites pendentes para o e-mail do usuário (onboarding). */
export async function listPendingInvitesForEmail(
  db: Database,
  email: string | null,
): Promise<Array<{ id: string; householdName: string; role: Role; expiresAt: Date }>> {
  if (!email) return [];
  const normalized = normalizeInviteEmail(email);

  const rows = await db
    .select({
      id: householdInvitations.id,
      role: householdInvitations.role,
      expiresAt: householdInvitations.expiresAt,
      householdName: households.name,
    })
    .from(householdInvitations)
    .innerJoin(households, eq(households.id, householdInvitations.householdId))
    .where(
      and(eq(householdInvitations.email, normalized), eq(householdInvitations.status, 'pending')),
    );

  return rows
    .filter((row) => !isInviteExpired(row.expiresAt))
    .map((row) => ({
      id: row.id,
      householdName: row.householdName,
      role: row.role as Role,
      expiresAt: row.expiresAt,
    }));
}
