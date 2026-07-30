import {
  acceptInviteBodySchema,
  acceptInviteByIdBodySchema,
  commitImportResponseSchema,
  createInviteBodySchema,
  exportTransactionsBodySchema,
  exportTransactionsResponseSchema,
  importPreviewResponseSchema,
  importTemplateResponseSchema,
  inviteMemberResponseSchema,
  jarvisMessageBodySchema,
  jarvisMessageResponseSchema,
  okResponseSchema,
  okWithRedirectResponseSchema,
  updateImportPreviewBodySchema,
  updateMemberRoleBodySchema,
} from '@tim/api-contract';
import {
  acceptHouseholdInvite,
  acceptHouseholdInviteById,
  commitImport,
  createHouseholdInvite,
  downloadImportTemplate,
  exportTransactions,
  previewImport,
  removeMember,
  revokeHouseholdInvite,
  sendJarvisMessage,
  updateImportPreview,
  updateMemberRole,
} from '@tim/application';
import { requireCapability, requireSession } from '@tim/auth';
import { households } from '@tim/db';
import { MEMBER_ROLE_LABEL } from '@tim/domain';
import { sendHouseholdInviteEmail } from '@tim/email';
import {
  removeMemberSchema,
  revokeHouseholdInviteSchema,
  updateMemberRoleSchema,
} from '@tim/validators';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createAppContext } from '../context.js';
import { env } from '../env.js';
import {
  ApiHttpError,
  handleApiRoute,
  jsonOk,
  parseWithSchema,
  requireApiContext,
} from '../http.js';
import { parseBody, parseJsonBody } from '../lib/mutation.js';

export const integrationRoutes = new Hono();

function appBaseUrl(): string {
  return (env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

function ok() {
  return jsonOk(parseWithSchema(okResponseSchema, { ok: true as const }));
}

function followRedirect(result: { redirectTo?: string }) {
  return jsonOk(
    parseWithSchema(okWithRedirectResponseSchema, {
      ok: true as const,
      redirectTo: result.redirectTo,
    }),
  );
}

async function requireAuthenticatedContext(request: Request) {
  const ctx = await createAppContext(request);
  if (!ctx.session?.userId) {
    throw new ApiHttpError('UNAUTHORIZED', 'Não autenticado');
  }
  return ctx;
}

// --- Members ---

integrationRoutes.post('/members/invites', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    requireCapability(session, 'members.manage');
    const body = parseBody(createInviteBodySchema, await parseJsonBody(c.req.raw));
    const invite = await createHouseholdInvite(ctx, body);
    const inviteUrl = `${appBaseUrl()}/invite/${invite.token}`;

    let emailSent = false;
    if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
      const [household] = await ctx.db
        .select({ name: households.name })
        .from(households)
        .where(eq(households.id, session.householdId))
        .limit(1);

      await sendHouseholdInviteEmail({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM_EMAIL,
        to: invite.email,
        inviterName: session.email?.split('@')[0] ?? 'Um admin',
        householdName: household?.name ?? 'seu household',
        roleLabel: MEMBER_ROLE_LABEL[invite.role],
        inviteUrl,
      });
      emailSent = true;
    }

    return jsonOk(parseWithSchema(inviteMemberResponseSchema, { inviteUrl, emailSent }));
  }),
);

integrationRoutes.delete('/members/invites/:invitationId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    requireCapability(session, 'members.manage');
    const input = revokeHouseholdInviteSchema.parse({
      invitationId: c.req.param('invitationId'),
    });
    await revokeHouseholdInvite(ctx, input);
    return ok();
  }),
);

integrationRoutes.patch('/members/:membershipId/role', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    requireCapability(session, 'members.manage');
    const body = parseBody(updateMemberRoleBodySchema, await parseJsonBody(c.req.raw));
    await updateMemberRole(
      ctx,
      updateMemberRoleSchema.parse({
        membershipId: c.req.param('membershipId'),
        role: body.role,
      }),
    );
    return ok();
  }),
);

integrationRoutes.delete('/members/:membershipId', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const session = requireSession(ctx.session);
    requireCapability(session, 'members.manage');
    const input = removeMemberSchema.parse({ membershipId: c.req.param('membershipId') });
    await removeMember(ctx, input);
    return ok();
  }),
);

integrationRoutes.post('/invites/accept', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireAuthenticatedContext(c.req.raw);
    const session = ctx.session!;
    const body = parseBody(acceptInviteBodySchema, await parseJsonBody(c.req.raw));
    await acceptHouseholdInvite(ctx, {
      token: body.token,
      userId: session.userId,
      email: session.email,
    });
    return followRedirect({ redirectTo: '/dashboard' });
  }),
);

integrationRoutes.post('/invites/accept-by-id', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireAuthenticatedContext(c.req.raw);
    const session = ctx.session!;
    const body = parseBody(acceptInviteByIdBodySchema, await parseJsonBody(c.req.raw));
    await acceptHouseholdInviteById(ctx, {
      invitationId: body.invitationId,
      userId: session.userId,
      email: session.email,
    });
    return followRedirect({ redirectTo: '/dashboard' });
  }),
);

// --- Imex ---

integrationRoutes.get('/imex/template', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const result = downloadImportTemplate(ctx);
    return jsonOk(parseWithSchema(importTemplateResponseSchema, result));
  }),
);

integrationRoutes.post('/imex/export', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(exportTransactionsBodySchema, await parseJsonBody(c.req.raw));
    const result = await exportTransactions(ctx, body);
    return jsonOk(parseWithSchema(exportTransactionsResponseSchema, result));
  }),
);

integrationRoutes.post('/imex/import/preview', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const form = await c.req.parseBody({ all: true });
    const file = form.file;
    if (!(file instanceof File)) {
      throw new ApiHttpError('VALIDATION', 'Arquivo obrigatório');
    }
    const yearRaw = form.year;
    const yearOverride = typeof yearRaw === 'string' && yearRaw.trim() ? Number(yearRaw) : null;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await previewImport(ctx, {
      fileName: file.name,
      buffer,
      yearOverride: Number.isFinite(yearOverride) ? yearOverride : null,
    });
    return jsonOk(parseWithSchema(importPreviewResponseSchema, result));
  }),
);

integrationRoutes.patch('/imex/import/:jobId/preview', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(updateImportPreviewBodySchema, await parseJsonBody(c.req.raw));
    const result = await updateImportPreview(ctx, {
      ...body,
      jobId: c.req.param('jobId'),
    });
    return jsonOk(result);
  }),
);

integrationRoutes.post('/imex/import/:jobId/commit', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const result = await commitImport(ctx, c.req.param('jobId'));
    return jsonOk(parseWithSchema(commitImportResponseSchema, result));
  }),
);

// --- Jarvis ---

integrationRoutes.post('/jarvis/messages', (c) =>
  handleApiRoute(async () => {
    const ctx = await requireApiContext(c.req.raw);
    const body = parseBody(jarvisMessageBodySchema, await parseJsonBody(c.req.raw));
    const result = await sendJarvisMessage(ctx, {
      content: body.content,
      source: body.source ?? 'text',
      threadId: body.threadId,
    });
    return jsonOk(parseWithSchema(jarvisMessageResponseSchema, result));
  }),
);
