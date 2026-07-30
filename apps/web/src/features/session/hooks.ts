'use client';

import { useQuery } from '@tanstack/react-query';
import type { BootstrapResponse, MeResponse } from '@tim/api-contract';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.me(),
    staleTime: 60_000,
  });
}

export function useBootstrap() {
  return useQuery({
    queryKey: queryKeys.bootstrap(),
    queryFn: () => api.bootstrap(),
    staleTime: 60_000,
  });
}

export type { MeResponse, BootstrapResponse };
