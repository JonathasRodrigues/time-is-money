export type PayableKind = 'fixed' | 'variable' | 'installment' | 'credit_card_invoice';

/** Classifica origem do lançamento a pagar para UI/filtros. */
export function resolvePayableKind(input: {
  seriesId: string | null | undefined;
  installmentId: string | null | undefined;
}): Exclude<PayableKind, 'credit_card_invoice'> {
  if (input.installmentId) return 'installment';
  if (input.seriesId) return 'fixed';
  return 'variable';
}

export const PAYABLE_KIND_LABEL: Record<PayableKind, string> = {
  fixed: 'Fixa',
  variable: 'Variável',
  installment: 'Parcela',
  credit_card_invoice: 'Fatura',
};

/**
 * Vencimento no mês `yearMonth` (YYYY-MM) no dia `dueDay` (1–28).
 * Se o dia passar do último dia do mês, usa o último dia.
 */
export function dueOnForMonth(yearMonth: string, dueDay: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) {
    throw new Error(`Invalid yearMonth: ${yearMonth}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const clampedDay = Math.min(28, Math.max(1, Math.floor(dueDay)));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(clampedDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function yearMonthFromIso(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) {
    throw new Error(`Invalid yearMonth: ${yearMonth}`);
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1 + delta;
  const date = new Date(Date.UTC(year, monthIndex, 1));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Média arredondada em centavos; null se não houver histórico. */
export function suggestAverageAmountCents(historyCents: ReadonlyArray<number>): number | null {
  const values = historyCents.filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / values.length);
}

export function estimatePayableCents(input: {
  amountCents: number | null | undefined;
  suggestedCents: number | null | undefined;
}): number {
  if (input.amountCents != null && input.amountCents > 0) return input.amountCents;
  if (input.suggestedCents != null && input.suggestedCents > 0) return input.suggestedCents;
  return 0;
}

/** Rótulo de status considerando receita vs despesa. */
export function transactionStatusLabel(
  type: 'income' | 'expense',
  status: 'pending' | 'paid',
): string {
  if (type === 'income') {
    return status === 'pending' ? 'a receber' : 'recebido';
  }
  return status === 'pending' ? 'a pagar' : 'pago';
}

/**
 * Avisa a partir do dia de recebimento até o fim do mês,
 * se ainda não houver confirmação neste YYYY-MM e não estiver adiado hoje.
 */
export function shouldPromptIncomeReceipt(input: {
  incomeDay: number | null | undefined;
  lastConfirmedMonth: string | null | undefined;
  snoozedOn?: string | null | undefined;
  todayIso: string;
}): boolean {
  if (input.incomeDay == null) return false;
  const day = Math.min(28, Math.max(1, Math.floor(input.incomeDay)));
  const yearMonth = yearMonthFromIso(input.todayIso);
  if (input.lastConfirmedMonth === yearMonth) return false;
  if (input.snoozedOn === input.todayIso) return false;
  const todayDay = Number(input.todayIso.slice(8, 10));
  return todayDay >= day;
}

/**
 * Receitas fixas do mês (série) pedem confirmação assim que o mês começa,
 * até serem pagas. Snooze vale só para o dia.
 */
export function shouldPromptPendingIncomes(input: {
  pendingCount: number;
  snoozedOn?: string | null | undefined;
  todayIso: string;
}): boolean {
  if (input.pendingCount <= 0) return false;
  if (input.snoozedOn === input.todayIso) return false;
  return true;
}

export function incomeDueOnForMonth(yearMonth: string, incomeDay: number): string {
  return dueOnForMonth(yearMonth, incomeDay);
}
