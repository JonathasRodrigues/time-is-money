import { z } from 'zod';

export const apiErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION',
  'NOT_FOUND',
  'CONFLICT',
  'NO_HOUSEHOLD',
  'INTERNAL',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.array(apiErrorDetailSchema).optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export const HTTP_STATUS_BY_ERROR_CODE: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  NO_HOUSEHOLD: 409,
  INTERNAL: 500,
};
