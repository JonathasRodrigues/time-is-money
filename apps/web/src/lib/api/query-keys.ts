const ROOT = ['tim'] as const;

/** Hierarchical React Query keys — prefix invalidation friendly. */
export const queryKeys = {
  root: ROOT,
  me: () => [...ROOT, 'me'] as const,
  bootstrap: () => [...ROOT, 'bootstrap'] as const,
  incomePrompt: () => [...ROOT, 'income-prompt'] as const,
  dashboard: (params: Record<string, string | undefined>) =>
    [...ROOT, 'dashboard', params] as const,
  payments: (params: Record<string, string | undefined>) => [...ROOT, 'payments', params] as const,
  transactions: (params: Record<string, string | undefined>) =>
    [...ROOT, 'transactions', params] as const,
  wealth: () => [...ROOT, 'wealth'] as const,
  financings: (params: Record<string, string | undefined>) =>
    [...ROOT, 'financings', params] as const,
  planning: (params: Record<string, string | undefined>) => [...ROOT, 'planning', params] as const,
  accounts: () => [...ROOT, 'accounts'] as const,
  categories: () => [...ROOT, 'categories'] as const,
  costCenters: () => [...ROOT, 'cost-centers'] as const,
  preferences: () => [...ROOT, 'preferences'] as const,
  members: () => [...ROOT, 'members'] as const,
} as const;

export function scopeSearchParams(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}
