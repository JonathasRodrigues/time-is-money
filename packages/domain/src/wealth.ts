export type AccountKind = 'cash' | 'checking' | 'savings' | 'investment_pot';
export type YieldType = 'none' | 'cdi' | 'fixed_annual';
export type PaymentRail = 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other';
/** Função do cartão físico: só crédito, só débito, ou os dois. */
export type CardMode = 'credit' | 'debit' | 'both';

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  cash: 'Dinheiro',
  checking: 'Conta corrente',
  savings: 'Poupança',
  investment_pot: 'Reserva / caixinha',
};

export const YIELD_TYPE_LABEL: Record<YieldType, string> = {
  none: 'Sem rendimento',
  cdi: '% do CDI',
  fixed_annual: 'Taxa fixa a.a.',
};

export const PAYMENT_RAIL_LABEL: Record<PaymentRail, string> = {
  pix: 'PIX',
  debit: 'Débito',
  ted: 'TED',
  boleto: 'Boleto',
  cash: 'Dinheiro',
  other: 'Outro',
};

export const CARD_MODE_LABEL: Record<CardMode, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  both: 'Crédito e débito',
};

export function cardHasCredit(mode: CardMode): boolean {
  return mode === 'credit' || mode === 'both';
}

export function cardHasDebit(mode: CardMode): boolean {
  return mode === 'debit' || mode === 'both';
}

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

/** Compra no cartão: só despesa paga aumenta a fatura. */
export function assertCardPurchase(input: {
  type: 'income' | 'expense';
  amountCents: number;
  cardArchived?: boolean;
}): void {
  if (input.cardArchived) {
    throw new Error('Cartão está arquivado');
  }
  if (input.type !== 'expense') {
    throw new Error('Somente despesas podem ser lançadas no cartão');
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error('Valor da compra deve ser positivo');
  }
}

/** Débito em conta (PIX/débito/TED): exige saldo disponível. */
export function assertAccountDebitBalance(input: {
  amountCents: number;
  accountBalanceCents: number;
  accountArchived?: boolean;
}): void {
  if (input.accountArchived) {
    throw new Error('Conta de pagamento está arquivada');
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error('Valor do pagamento deve ser positivo');
  }
  if (input.accountBalanceCents < input.amountCents) {
    throw new Error('Saldo insuficiente na conta de pagamento');
  }
}

/** Há saldo suficiente para debitar `amountCents` desta conta. */
export function accountHasSufficientBalance(input: {
  amountCents: number;
  accountBalanceCents: number;
}): boolean {
  return (
    Number.isFinite(input.amountCents) &&
    input.amountCents > 0 &&
    input.accountBalanceCents >= input.amountCents
  );
}

/** Pagamento de fatura: debita conta e reduz saldo da fatura. */
export function assertPayInvoice(input: {
  amountCents: number;
  accountBalanceCents: number;
  invoiceBalanceCents: number;
  accountArchived?: boolean;
  cardArchived?: boolean;
}): void {
  if (input.cardArchived) {
    throw new Error('Cartão está arquivado');
  }
  assertAccountDebitBalance({
    amountCents: input.amountCents,
    accountBalanceCents: input.accountBalanceCents,
    accountArchived: input.accountArchived,
  });
  if (input.invoiceBalanceCents < input.amountCents) {
    throw new Error('Valor maior que o saldo da fatura');
  }
}

/** Patrimônio líquido = ativos − faturas de cartão. */
export function netWorthCents(input: { assetsCents: number; liabilitiesCents: number }): number {
  return input.assetsCents - input.liabilitiesCents;
}

/** Limite disponível = limite − fatura (nunca negativo no display). */
export function availableCreditCents(input: {
  creditLimitCents: number;
  invoiceBalanceCents: number;
}): number {
  return Math.max(0, input.creditLimitCents - input.invoiceBalanceCents);
}
