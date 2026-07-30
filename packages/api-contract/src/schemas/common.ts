import { z } from 'zod';
import { isoDateSchema } from '@tim/validators';

export const roleSchema = z.enum(['admin', 'editor', 'viewer']);

export const themeSchema = z.enum(['light', 'dark', 'system']);

export const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Mês deve ser YYYY-MM');

export const dateRangeQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  period: z.string().max(40).optional(),
  center: z.union([z.string().uuid(), z.literal('')]).optional(),
  month: yearMonthSchema.optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

export const cursorPageMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  limit: z.number().int().positive(),
});

export const idNameSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
