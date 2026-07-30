'use client';

import { useQuery } from '@tanstack/react-query';
import { IncomeReceiptBanner } from '@/components/income-receipt-banner';
import { api } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/query-keys';

export function IncomePromptHost(): React.ReactElement | null {
  const { data } = useQuery({
    queryKey: queryKeys.incomePrompt(),
    queryFn: () => api.incomePrompt.get(),
    staleTime: 60_000,
  });

  if (!data?.show) {
    return null;
  }

  return (
    <IncomeReceiptBanner
      incomeDay={data.incomeDay}
      pendingIncomes={data.mode === 'series' ? data.pendingIncomes : []}
      accounts={data.accounts}
    />
  );
}
