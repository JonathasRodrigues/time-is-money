import { z } from 'zod';

export const okResponseSchema = z.object({
  ok: z.literal(true),
});

export const okWithIdResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string().uuid(),
});

export const okWithPlanIdResponseSchema = z.object({
  ok: z.literal(true),
  planId: z.string().uuid(),
});

export const okWithHouseholdIdResponseSchema = z.object({
  ok: z.literal(true),
  householdId: z.string().uuid(),
});

export const okWithRedirectResponseSchema = z.object({
  ok: z.literal(true),
  redirectTo: z.string().optional(),
});

export type OkResponse = z.infer<typeof okResponseSchema>;
export type OkWithIdResponse = z.infer<typeof okWithIdResponseSchema>;
export type OkWithPlanIdResponse = z.infer<typeof okWithPlanIdResponseSchema>;
export type OkWithHouseholdIdResponse = z.infer<typeof okWithHouseholdIdResponseSchema>;
export type OkWithRedirectResponse = z.infer<typeof okWithRedirectResponseSchema>;
