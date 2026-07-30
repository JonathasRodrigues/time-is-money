import { z } from 'zod';
import { yearMonthSchema } from './common';

export const ensureInstancesBodySchema = z.object({
  yearMonth: yearMonthSchema.optional(),
});

export const ensureInstancesResponseSchema = z.object({
  ok: z.literal(true),
  yearMonth: yearMonthSchema,
});

export type EnsureInstancesBody = z.infer<typeof ensureInstancesBodySchema>;
export type EnsureInstancesResponse = z.infer<typeof ensureInstancesResponseSchema>;
