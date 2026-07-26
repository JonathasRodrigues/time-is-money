export type AccountKind = 'cash' | 'checking' | 'investment_pot';
export type YieldType = 'none' | 'cdi' | 'fixed_annual';

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  cash: 'Dinheiro',
  checking: 'Conta corrente',
  investment_pot: 'Investimento / caixinha',
};

export const YIELD_TYPE_LABEL: Record<YieldType, string> = {
  none: 'Sem rendimento',
  cdi: '% do CDI',
  fixed_annual: 'Taxa fixa a.a.',
};

/** Rótulo amigável do rendimento. */
export function formatYieldLabel(
  yieldType: YieldType,
  yieldBps: number | null | undefined,
): string {
  if (yieldType === 'none' || yieldBps == null) return '—';
  if (yieldType === 'cdi') {
    return `${(yieldBps / 100).toFixed(yieldBps % 100 === 0 ? 0 : 1)}% CDI`;
  }
  return `${(yieldBps / 100).toFixed(2)}% a.a.`;
}

/**
 * Estimativa grosseira de rendimento mensal em centavos.
 * CDI assume CDI a.a. de referência (default 13,15% = 1315 bps).
 */
export function estimateMonthlyYieldCents(input: {
  balanceCents: number;
  yieldType: YieldType;
  yieldBps: number | null | undefined;
  cdiAnnualBps?: number;
}): number {
  if (input.balanceCents <= 0 || input.yieldType === 'none' || input.yieldBps == null) {
    return 0;
  }
  const cdiAnnual = input.cdiAnnualBps ?? 1315;
  let annualBps = 0;
  if (input.yieldType === 'cdi') {
    annualBps = Math.round((cdiAnnual * input.yieldBps) / 10_000);
  } else {
    annualBps = input.yieldBps;
  }
  return Math.round((input.balanceCents * annualBps) / 10_000 / 12);
}

/**
 * Valida transferência interna entre contas (inclui caixinhas).
 * Lança Error com mensagem em pt-BR se inválida.
 */
export function assertTransferAllowed(input: {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  fromBalanceCents: number;
  fromArchived?: boolean;
  toArchived?: boolean;
}): void {
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('Origem e destino devem ser contas diferentes');
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error('Valor da transferência deve ser positivo');
  }
  if (input.fromArchived) {
    throw new Error('Conta de origem está arquivada');
  }
  if (input.toArchived) {
    throw new Error('Conta de destino está arquivada');
  }
  if (input.fromBalanceCents < input.amountCents) {
    throw new Error('Saldo insuficiente na conta de origem');
  }
}

/** Rótulo curto para listagem (ex.: "Nubank → Caixinha Viagem"). */
export function formatTransferRouteLabel(fromName: string, toName: string): string {
  return `${fromName} → ${toName}`;
}
