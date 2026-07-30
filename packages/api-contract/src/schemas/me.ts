import { z } from 'zod';
import { roleSchema } from './common';

export const meResponseSchema = z.object({
  userId: z.string().min(1),
  email: z.string().nullable(),
  householdId: z.string(),
  role: roleSchema,
  mfaEnabled: z.boolean(),
  canManageMembers: z.boolean(),
  capabilities: z.array(z.string()),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
