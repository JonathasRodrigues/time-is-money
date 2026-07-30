import { z } from 'zod';

export const categoryRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['income', 'expense']),
  isSystem: z.boolean(),
});

export const categoriesResponseSchema = z.object({
  items: z.array(categoryRowSchema),
});

export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;
