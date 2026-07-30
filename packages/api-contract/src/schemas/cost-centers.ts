import { z } from 'zod';

export const costCenterRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable(),
  isSystem: z.boolean(),
});

export const costCentersResponseSchema = z.object({
  items: z.array(costCenterRowSchema),
});

export type CostCentersResponse = z.infer<typeof costCentersResponseSchema>;
