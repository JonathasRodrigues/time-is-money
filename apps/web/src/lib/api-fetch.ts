import { API_VERSION_HEADER, apiErrorBodySchema, type ApiErrorCode } from '@tim/api-contract';
import { handleMockApiRequest, isMockApiMode, MockApiError } from '@tim/mocks/api';

export class ApiClientError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Bearer token for React Native; web uses cookies by default. */
  accessToken?: string;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  if (isMockApiMode()) {
    try {
      return await handleMockApiRequest<T>(path, {
        method: options.method,
        body: options.body,
      });
    } catch (error) {
      if (error instanceof MockApiError) {
        throw new ApiClientError(error.code, error.message, error.status);
      }
      throw error;
    }
  }

  const { body, accessToken, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  headers.set('Accept', 'application/json');
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(path, {
    ...rest,
    credentials: accessToken ? rest.credentials : (rest.credentials ?? 'include'),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const version = response.headers.get(API_VERSION_HEADER);
  if (version && version !== '1') {
    console.warn(`[apiFetch] unexpected ${API_VERSION_HEADER}=${version}`);
  }

  if (!response.ok) {
    let code: ApiErrorCode = 'INTERNAL';
    let message = `HTTP ${response.status}`;
    try {
      const json: unknown = await response.json();
      const parsed = apiErrorBodySchema.safeParse(json);
      if (parsed.success) {
        code = parsed.data.error.code;
        message = parsed.data.error.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiClientError(code, message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Multipart/form-data (file uploads). Do not set Content-Type — browser sets boundary. */
export async function apiFetchForm<T>(
  path: string,
  formData: FormData,
  options: Omit<ApiFetchOptions, 'body'> = {},
): Promise<T> {
  if (isMockApiMode()) {
    try {
      return await handleMockApiRequest<T>(path, {
        method: options.method ?? 'POST',
        formData,
      });
    } catch (error) {
      if (error instanceof MockApiError) {
        throw new ApiClientError(error.code, error.message, error.status);
      }
      throw error;
    }
  }

  const { accessToken, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  headers.set('Accept', 'application/json');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(path, {
    ...rest,
    method: rest.method ?? 'POST',
    credentials: accessToken ? rest.credentials : (rest.credentials ?? 'include'),
    headers,
    body: formData,
  });

  if (!response.ok) {
    let code: ApiErrorCode = 'INTERNAL';
    let message = `HTTP ${response.status}`;
    try {
      const json: unknown = await response.json();
      const parsed = apiErrorBodySchema.safeParse(json);
      if (parsed.success) {
        code = parsed.data.error.code;
        message = parsed.data.error.message;
      }
    } catch {
      // ignore
    }
    throw new ApiClientError(code, message, response.status);
  }

  return (await response.json()) as T;
}
