import { z } from 'zod';

export const parsedImportRowSchema = z.object({
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  type: z.enum(['income', 'expense']),
  description: z.string().optional(),
  category: z.string().optional(),
  costCenter: z.string().optional(),
  account: z.string().optional(),
  /** Método bruto da planilha Contas (ex.: Cartão Jooh) — usado no mapeamento UI. */
  paymentMethod: z.string().max(120).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export type ParsedImportRow = z.infer<typeof parsedImportRowSchema>;

export interface ImportRowResult {
  rowNumber: number;
  status: 'ok' | 'error' | 'skip';
  data?: ParsedImportRow;
  reason?: string;
}
