import { z } from 'zod';
import { roleSchema } from './common';

export const memberRowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  email: z.string().nullable(),
  role: roleSchema,
  createdAt: z.string(),
  isSelf: z.boolean(),
});

export const inviteRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: roleSchema,
  expiresAt: z.string(),
});

export const membersResponseSchema = z.object({
  currentUserId: z.string(),
  members: z.array(memberRowSchema),
  invites: z.array(inviteRowSchema),
});

export type MembersResponse = z.infer<typeof membersResponseSchema>;
