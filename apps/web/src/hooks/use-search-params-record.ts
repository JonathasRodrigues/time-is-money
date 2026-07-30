'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

/** Stable record of URL search params for query keys and API calls. */
export function useSearchParamsRecord(): Record<string, string | undefined> {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const record: Record<string, string | undefined> = {};
    searchParams.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }, [searchParams]);
}
