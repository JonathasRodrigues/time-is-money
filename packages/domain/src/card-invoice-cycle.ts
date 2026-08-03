import { dueOnForMonth, shiftYearMonth, yearMonthFromIso } from './payments';

export type CreditCardInvoiceStatus = 'open' | 'closed' | 'paid';

export interface CardInvoiceCycle {
  /** Data de fechamento do ciclo (inclusive). */
  closesOn: string;
  /** Data de vencimento da fatura. */
  dueOn: string;
}

function clampDay(day: number): number {
  return Math.min(28, Math.max(1, Math.floor(day)));
}

function dateOnYearMonth(yearMonth: string, day: number): string {
  return dueOnForMonth(yearMonth, clampDay(day));
}

/**
 * Ciclo de fatura BR que recebe a compra em `purchaseOn`.
 * Compra **após** o fechamento cai no próximo ciclo.
 */
export function resolveInvoiceCycle(input: {
  closingDay: number;
  dueDay: number;
  purchaseOn: string;
}): CardInvoiceCycle {
  const closingDay = clampDay(input.closingDay);
  const dueDay = clampDay(input.dueDay);
  const purchaseYm = yearMonthFromIso(input.purchaseOn);

  const candidateClose = dateOnYearMonth(purchaseYm, closingDay);
  const closesOn =
    input.purchaseOn > candidateClose
      ? dateOnYearMonth(shiftYearMonth(purchaseYm, 1), closingDay)
      : candidateClose;

  const closesYm = yearMonthFromIso(closesOn);
  const dueYm = dueDay > closingDay ? closesYm : shiftYearMonth(closesYm, 1);
  const dueOn = dateOnYearMonth(dueYm, dueDay);

  return { closesOn, dueOn };
}

/** Fatura deve fechar quando `todayIso` é estritamente após `closesOn` e ainda está open. */
export function shouldCloseInvoice(input: {
  status: CreditCardInvoiceStatus;
  closesOn: string;
  todayIso: string;
}): boolean {
  return input.status === 'open' && input.todayIso > input.closesOn;
}

/** Rótulo de forma de pagamento: meio primeiro, conta/banco como vínculo. */
export function formatAccountPaymentMethodLabel(input: {
  accountName: string;
  institutionName?: string | null;
  paymentRail?: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null;
}): string {
  const linked = input.institutionName
    ? `${input.accountName} · ${input.institutionName}`
    : input.accountName;
  if (!input.paymentRail) return linked;
  const railLabel: Record<string, string> = {
    pix: 'PIX',
    debit: 'Débito',
    ted: 'TED',
    boleto: 'Boleto',
    cash: 'Dinheiro',
    other: 'Outro',
  };
  return `${railLabel[input.paymentRail] ?? input.paymentRail} · ${linked}`;
}

/** Rótulo de forma de pagamento: crédito primeiro, banco/conta como vínculo. */
export function formatCreditCardPaymentMethodLabel(input: {
  cardName: string;
  lastFour?: string | null;
  institutionName?: string | null;
  accountName?: string | null;
}): string {
  const tail = input.lastFour ? ` ·••• ${input.lastFour}` : '';
  const linked = input.institutionName
    ? ` · ${input.institutionName}`
    : input.accountName
      ? ` · ${input.accountName}`
      : '';
  return `Crédito · ${input.cardName}${tail}${linked}`;
}

/** Meios que saem/entram na conta bancária na hora (não fatura). */
export const INSTANT_ACCOUNT_PAYMENT_RAILS = ['pix', 'debit', 'ted', 'boleto'] as const;

export type InstantAccountPaymentRail = (typeof INSTANT_ACCOUNT_PAYMENT_RAILS)[number];

const INSTANT_RAIL_SET = new Set<string>(INSTANT_ACCOUNT_PAYMENT_RAILS);

/** Default ao criar conta: caixinha sem formas; demais com os 4 rails. */
export function defaultAllowedPaymentRails(
  kind: 'cash' | 'checking' | 'savings' | 'investment_pot',
): InstantAccountPaymentRail[] {
  if (kind === 'investment_pot') return [];
  return [...INSTANT_ACCOUNT_PAYMENT_RAILS];
}

/** Mantém só rails instantâneos válidos e únicos (ordem estável). */
export function normalizeAllowedPaymentRails(
  rails: readonly string[],
): InstantAccountPaymentRail[] {
  const seen = new Set<InstantAccountPaymentRail>();
  const result: InstantAccountPaymentRail[] = [];
  for (const rail of rails) {
    if (!INSTANT_RAIL_SET.has(rail)) continue;
    const typed = rail as InstantAccountPaymentRail;
    if (seen.has(typed)) continue;
    seen.add(typed);
    result.push(typed);
  }
  return result;
}

/** Aceita array, JSON string (jsonb) ou unknown vindo do driver. */
export function coerceAllowedPaymentRails(value: unknown): InstantAccountPaymentRail[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return normalizeAllowedPaymentRails(parsed.map(String));
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return normalizeAllowedPaymentRails(value.map(String));
  }
  return [];
}

export function accountAllowsPaymentRail(
  allowedRails: readonly InstantAccountPaymentRail[],
  paymentRail: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null | undefined,
): boolean {
  const rail = paymentRail ?? 'pix';
  return (allowedRails as readonly string[]).includes(rail);
}

/**
 * Conta + PIX/débito/TED/boleto: move saldo agora.
 * Crédito: só fatura. Dinheiro: não mexe em conta bancária.
 */
export function paymentMethodMovesAccountBalance(input: {
  type: 'account' | 'credit_card';
  paymentRail?: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null;
}): boolean {
  if (input.type === 'credit_card') return false;
  if (input.paymentRail === 'cash') return false;
  return true;
}
