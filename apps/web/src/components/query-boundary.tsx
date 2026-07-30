'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api-fetch';

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  skeleton: React.ReactNode;
  children: (data: T) => React.ReactNode;
  emptyMessage?: string;
}

export function QueryBoundary<T>({
  query,
  skeleton,
  children,
  emptyMessage,
}: QueryBoundaryProps<T>): React.ReactElement {
  const { data, isPending, isError, error, refetch } = query;

  if (isPending) {
    return <>{skeleton}</>;
  }

  if (isError) {
    const message =
      error instanceof ApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Erro ao carregar dados';

    return (
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center"
        role="alert"
      >
        <AlertCircle className="size-10 text-destructive" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">Não foi possível carregar</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="size-4" aria-hidden />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div className="rounded-xl border px-6 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage ?? 'Nenhum dado disponível.'}
      </div>
    );
  }

  return <>{children(data)}</>;
}
