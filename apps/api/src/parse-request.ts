import type { ZodSchema } from 'zod';

export function searchParamsToRecord(url: URL): Record<string, string | undefined> {
  const record: Record<string, string | undefined> = {};
  url.searchParams.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

export function parseQueryParams<T>(
  schema: ZodSchema<T>,
  record: Record<string, string | undefined>,
): T {
  return schema.parse(record);
}
