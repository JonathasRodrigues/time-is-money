import { z } from 'zod';
import {
  acceptHouseholdInviteSchema,
  createHouseholdInviteSchema,
  jarvisMessageSchema,
  removeMemberSchema,
  revokeHouseholdInviteSchema,
  updateImportPreviewSchema,
  updateMemberRoleSchema,
} from '@tim/validators';

export const createInviteBodySchema = createHouseholdInviteSchema;
export const revokeInviteParamsSchema = z.object({ invitationId: z.string().uuid() });
export const updateMemberRoleBodySchema = updateMemberRoleSchema.omit({ membershipId: true });
export const removeMemberParamsSchema = z.object({ membershipId: z.string().uuid() });
export const acceptInviteBodySchema = acceptHouseholdInviteSchema;
export const acceptInviteByIdBodySchema = z.object({ invitationId: z.string().uuid() });

export const inviteMemberResponseSchema = z.object({
  inviteUrl: z.string().url(),
  emailSent: z.boolean(),
});

export const exportTransactionsBodySchema = z.object({
  format: z.enum(['csv', 'xlsx']),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const exportTransactionsResponseSchema = z.object({
  base64: z.string(),
  filename: z.string(),
  format: z.enum(['csv', 'xlsx']),
});

export const importTemplateResponseSchema = z.object({
  csv: z.string(),
});

export const importPreviewRowSchema = z.object({
  id: z.string().uuid(),
  rowNumber: z.number().int(),
  status: z.enum(['ok', 'error', 'skip']),
  reason: z.string().nullable().optional(),
  occurredOn: z.string().optional(),
  amountCents: z.number().int().optional(),
  type: z.enum(['income', 'expense']).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  costCenter: z.string().optional(),
  account: z.string().optional(),
  paymentMethod: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const importPreviewResponseSchema = z.object({
  jobId: z.string().uuid(),
  importFormat: z.enum(['flat', 'contas-monthly']),
  year: z.number().int().nullable(),
  fileName: z.string(),
  ok: z.number().int(),
  error: z.number().int(),
  skip: z.number().int(),
  rows: z.array(importPreviewRowSchema),
  paymentMethods: z.array(
    z.object({
      method: z.string(),
      count: z.number().int(),
      suggestedAccount: z.string().nullable(),
      matchedAccount: z.string().nullable(),
    }),
  ),
  options: z.object({
    categories: z.array(
      z.object({ id: z.string().uuid(), name: z.string(), type: z.string().optional() }),
    ),
    accounts: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    costCenters: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  }),
});

export const updateImportPreviewBodySchema = updateImportPreviewSchema.omit({ jobId: true });

export const commitImportResponseSchema = z.object({
  created: z.number().int(),
  skipped: z.number().int(),
  errors: z.number().int(),
});

export const jarvisMessageBodySchema = jarvisMessageSchema;

export const jarvisMessageResponseSchema = z.object({
  reply: z.string(),
  threadId: z.string().uuid(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  intent: z.unknown(),
});

export type InviteMemberResponse = z.infer<typeof inviteMemberResponseSchema>;
export type ExportTransactionsResponse = z.infer<typeof exportTransactionsResponseSchema>;
export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>;
export type ImportPreviewRowDto = z.infer<typeof importPreviewRowSchema>;
export type CommitImportResponse = z.infer<typeof commitImportResponseSchema>;
export type JarvisMessageResponse = z.infer<typeof jarvisMessageResponseSchema>;
