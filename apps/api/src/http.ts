import type { AuthSession } from '@tim/auth';
import { AuthError, requireSession } from '@tim/auth';
import {
  API_VERSION_HEADER,
  HTTP_STATUS_BY_ERROR_CODE,
  type ApiErrorBody,
  type ApiErrorCode,
  apiErrorBodySchema,
} from '@tim/api-contract';
import type { AppContext } from '@tim/application';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { createAppContext } from './context.js';

export class ApiHttpError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ApiErrorBody['error']['details'],
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

export function jsonOk<T>(body: T, init?: { status?: number }): Response {
  return Response.json(body, {
    status: init?.status ?? 200,
    headers: {
      [API_VERSION_HEADER]: '1',
      'Content-Type': 'application/json',
    },
  });
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  details?: ApiErrorBody['error']['details'],
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  };
  apiErrorBodySchema.parse(body);
  return Response.json(body, {
    status: HTTP_STATUS_BY_ERROR_CODE[code],
    headers: {
      [API_VERSION_HEADER]: '1',
      'Content-Type': 'application/json',
    },
  });
}

export async function requireApiSession(request: Request): Promise<AuthSession> {
  const ctx = await createAppContext(request);
  try {
    return requireSession(ctx.session);
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.code === 'UNAUTHENTICATED') {
        throw new ApiHttpError('UNAUTHORIZED', err.message);
      }
      if (err.code === 'NO_HOUSEHOLD') {
        throw new ApiHttpError('NO_HOUSEHOLD', err.message);
      }
      if (err.code === 'FORBIDDEN' || err.code === 'MFA_REQUIRED') {
        throw new ApiHttpError('FORBIDDEN', err.message);
      }
    }
    throw new ApiHttpError('UNAUTHORIZED', 'Não autenticado');
  }
}

export async function requireApiContext(request: Request): Promise<AppContext> {
  await requireApiSession(request);
  return createAppContext(request);
}

export function parseWithSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiHttpError(
        'VALIDATION',
        'Dados inválidos',
        err.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      );
    }
    throw err;
  }
}

export async function handleApiRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof ApiHttpError) {
      return jsonError(err.code, err.message, err.details);
    }
    if (err instanceof AuthError) {
      if (err.code === 'UNAUTHENTICATED') return jsonError('UNAUTHORIZED', err.message);
      if (err.code === 'NO_HOUSEHOLD') return jsonError('NO_HOUSEHOLD', err.message);
      return jsonError('FORBIDDEN', err.message);
    }
    if (err instanceof ZodError) {
      return jsonError(
        'VALIDATION',
        'Dados inválidos',
        err.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      );
    }
    console.error('[api]', err);
    return jsonError('INTERNAL', 'Erro interno');
  }
}
