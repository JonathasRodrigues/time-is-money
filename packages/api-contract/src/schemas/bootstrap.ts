import { z } from 'zod';
import { idNameSchema, themeSchema } from './common';

export const bootstrapResponseSchema = z.object({
  ttsEnabled: z.boolean(),
  theme: themeSchema,
  incomeDay: z.number().int().min(1).max(28).nullable(),
  costCenters: z.array(idNameSchema),
  accounts: z.array(
    idNameSchema.extend({
      isArchived: z.boolean(),
    }),
  ),
  categories: z.array(
    idNameSchema.extend({
      type: z.enum(['income', 'expense']),
    }),
  ),
});

export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
