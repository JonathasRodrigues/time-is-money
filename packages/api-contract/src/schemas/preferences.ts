import { z } from 'zod';
import { idNameSchema, themeSchema } from './common';

export const preferencesResponseSchema = z.object({
  emailDueReminders: z.boolean(),
  reminderWindowsDays: z.array(z.number().int()),
  weeklySummary: z.boolean(),
  incomeDay: z.number().int().min(1).max(28).nullable(),
  theme: themeSchema,
  ttsEnabled: z.boolean(),
  defaultCostCenterId: z.string().uuid().nullable(),
  defaultAccountId: z.string().uuid().nullable(),
  lookups: z.object({
    centers: z.array(idNameSchema),
    accounts: z.array(idNameSchema),
  }),
});

export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>;
