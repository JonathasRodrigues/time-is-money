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
