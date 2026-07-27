import type { AmortizationRow, AmortizationSystem } from './index';

export type PlanKind = 'travel' | 'financing_payoff' | 'custom';
export type FinancingCategory = 'real_estate' | 'vehicle' | 'personal' | 'other';

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  travel: 'Viagem',
  financing_payoff: 'Quitação',
  custom: 'Personalizado',
};

export const FINANCING_CATEGORY_LABEL: Record<FinancingCategory, string> = {
  real_estate: 'Imóvel',
  vehicle: 'Veículo',
  personal: 'Pessoal',
  other: 'Outro',
};

export interface PlanItemLike {
  amountCents: number;
}

export interface PlanProgress {
  savedCents: number;
  targetCents: number;
  remainingCents: number;
  progressPercent: number;
  isComplete: boolean;
}

export interface PayoffSimulationResult {
  months: number;
  totalPaidCents: number;
  totalInterestCents: number;
  totalPrincipalCents: number;
  schedule: AmortizationRow[];
}

export interface PayoffStrategyComparison {
  label: string;
  months: number;
  totalInterestCents: number;
  totalPaidCents: number;
  extraMonthlyCents: number;
  interestSavedCents: number;
}

function roundCents(value: number): number {
  return Math.round(value);
}

function monthlyRateFromAnnualBps(annualRateBps: number): number {
  return annualRateBps / 10_000 / 12;
}

function monthlyRate(annualRateBps: number | undefined): number {
  if (annualRateBps == null || annualRateBps <= 0) return 0;
  return monthlyRateFromAnnualBps(annualRateBps);
}

/** Soma os itens do plano (meta total). */
export function sumPlanItems(items: readonly PlanItemLike[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.amountCents), 0);
}

/** Meses restantes até a data alvo (mínimo 1 se data futura, 0 se vencida). */
export function monthsUntil(targetDate: string, fromDate?: string): number {
  const from = fromDate ?? new Date().toISOString().slice(0, 10);
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = targetDate.split('-').map(Number);
  if (fy === undefined || fm === undefined || ty === undefined || tm === undefined) {
    return 1;
  }
  const diff = (ty - fy) * 12 + (tm - fm);
  return Math.max(0, diff);
}

/** Progresso da meta vs. saldo guardado. */
export function computePlanProgress(savedCents: number, targetCents: number): PlanProgress {
  const saved = Math.max(0, savedCents);
  const target = Math.max(0, targetCents);
  const remainingCents = Math.max(0, target - saved);
  const progressPercent =
    target === 0 ? (saved > 0 ? 100 : 0) : Math.min(100, Math.round((saved / target) * 100));
  return {
    savedCents: saved,
    targetCents: target,
    remainingCents,
    progressPercent,
    isComplete: target > 0 && saved >= target,
  };
}

/** Aporte mensal necessário para atingir a meta na data alvo. */
export function computeMonthlySavingsNeeded(input: {
  targetCents: number;
  savedCents: number;
  targetDate: string;
  fromDate?: string;
}): number {
  const remaining = Math.max(0, input.targetCents - Math.max(0, input.savedCents));
  if (remaining === 0) return 0;
  const months = monthsUntil(input.targetDate, input.fromDate);
  if (months <= 0) return remaining;
  return Math.ceil(remaining / months);
}

export interface PlanContributionRow {
  dueOn: string;
  amountCents: number;
}

export interface ContributionScheduleAnalysis {
  targetCents: number;
  savedCents: number;
  plannedCents: number;
  projectedTotalCents: number;
  /** Positivo = ainda falta; negativo = sobra no cronograma. */
  gapCents: number;
  meetsTarget: boolean;
  monthCount: number;
}

/** Soma dos aportes planejados no cronograma. */
export function sumContributions(contributions: readonly PlanItemLike[]): number {
  return contributions.reduce((sum, row) => sum + Math.max(0, row.amountCents), 0);
}

/** Data alvo a partir de hoje + N meses. */
export function targetDateFromMonthCount(fromDate: string, monthCount: number): string {
  return addMonthsLocal(fromDate, Math.max(1, monthCount));
}

/** Gera cronograma mensal com o mesmo valor em cada mês. */
export function buildMonthlyContributionSchedule(input: {
  startOn: string;
  monthCount: number;
  monthlyCents: number;
}): PlanContributionRow[] {
  const monthCount = Math.max(1, Math.min(120, Math.floor(input.monthCount)));
  const monthlyCents = Math.max(0, Math.floor(input.monthlyCents));
  return Array.from({ length: monthCount }, (_, index) => ({
    dueOn: addMonthsLocal(input.startOn, index),
    amountCents: monthlyCents,
  }));
}

/** Analisa se o cronograma + saldo atual cobre a meta. */
export function analyzeContributionSchedule(input: {
  targetCents: number;
  savedCents: number;
  contributions: readonly PlanItemLike[];
}): ContributionScheduleAnalysis {
  const targetCents = Math.max(0, input.targetCents);
  const savedCents = Math.max(0, input.savedCents);
  const plannedCents = sumContributions(input.contributions);
  const projectedTotalCents = savedCents + plannedCents;
  const gapCents = targetCents - projectedTotalCents;
  return {
    targetCents,
    savedCents,
    plannedCents,
    projectedTotalCents,
    gapCents,
    meetsTarget: gapCents <= 0,
    monthCount: input.contributions.length,
  };
}

/** Distribui o gap restante no último mês do cronograma. */
export function applyGapToLastContribution(
  contributions: readonly PlanContributionRow[],
  gapCents: number,
): PlanContributionRow[] {
  if (contributions.length === 0 || gapCents === 0) {
    return [...contributions];
  }
  const rows = contributions.map((row) => ({ ...row }));
  const last = rows[rows.length - 1];
  if (!last) return rows;
  last.amountCents = Math.max(0, last.amountCents + gapCents);
  return rows;
}

/** Sistema de amortização sugerido por categoria de financiamento. */
export function defaultAmortizationForCategory(category: FinancingCategory): AmortizationSystem {
  if (category === 'real_estate') return 'sac';
  if (category === 'vehicle') return 'price';
  return 'fixed';
}

function simulateMonthByMonth(input: {
  balanceCents: number;
  system: AmortizationSystem;
  annualRateBps?: number;
  installmentAmountCents?: number;
  amortizationCents?: number;
  extraPaymentCents: number;
  firstDueOn: string;
  maxMonths?: number;
}): PayoffSimulationResult {
  const i = monthlyRate(input.annualRateBps);
  const maxMonths = input.maxMonths ?? 600;
  let balance = Math.max(0, input.balanceCents);
  const schedule: AmortizationRow[] = [];
  let totalInterestCents = 0;
  let totalPaidCents = 0;

  for (let n = 1; n <= maxMonths && balance > 0; n += 1) {
    const interestCents = roundCents(balance * i);
    let principalFromPayment = 0;
    let amountCents = 0;

    if (input.system === 'sac') {
      const amort =
        input.amortizationCents != null && input.amortizationCents > 0
          ? input.amortizationCents
          : roundCents(balance / Math.max(1, maxMonths - n + 1));
      principalFromPayment = Math.min(balance, amort);
      amountCents = interestCents + principalFromPayment;
    } else {
      const pmt = input.installmentAmountCents ?? 0;
      principalFromPayment = Math.max(0, Math.min(balance, pmt - interestCents));
      if (principalFromPayment <= 0 && pmt > 0) {
        principalFromPayment = Math.min(balance, pmt);
      }
      amountCents = interestCents + principalFromPayment;
    }

    const extraPrincipal = Math.min(
      balance - principalFromPayment,
      Math.max(0, input.extraPaymentCents),
    );
    const totalPrincipal = principalFromPayment + extraPrincipal;
    const totalAmount = amountCents + extraPrincipal;
    balance -= totalPrincipal;

    totalInterestCents += interestCents;
    totalPaidCents += totalAmount;

    schedule.push({
      number: n,
      dueOn: addMonthsLocal(input.firstDueOn, n - 1),
      amountCents: totalAmount,
      interestCents,
      principalCents: totalPrincipal,
      balanceAfterCents: Math.max(0, balance),
    });
  }

  return {
    months: schedule.length,
    totalPaidCents,
    totalInterestCents,
    totalPrincipalCents: input.balanceCents - Math.max(0, balance),
    schedule,
  };
}

function addMonthsLocal(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return isoDate;
  const anchor = new Date(Date.UTC(y, m - 1 + months, 1));
  const year = anchor.getUTCFullYear();
  const monthIndex = anchor.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Simula quitação com amortização extra mensal fixa. */
export function simulatePayoffWithExtraPayment(input: {
  balanceCents: number;
  system: AmortizationSystem;
  annualRateBps?: number;
  installmentAmountCents?: number;
  amortizationCents?: number;
  extraPaymentCents: number;
  firstDueOn: string;
}): PayoffSimulationResult {
  return simulateMonthByMonth({
    ...input,
    extraPaymentCents: Math.max(0, input.extraPaymentCents),
  });
}

/** Calcula amortização extra mensal necessária para quitar na data alvo. */
export function simulatePayoffByTargetDate(input: {
  balanceCents: number;
  system: AmortizationSystem;
  annualRateBps?: number;
  installmentAmountCents?: number;
  amortizationCents?: number;
  firstDueOn: string;
  targetDate: string;
  fromDate?: string;
}): { extraMonthlyCents: number; simulation: PayoffSimulationResult } {
  const targetMonths = monthsUntil(input.targetDate, input.fromDate);
  if (targetMonths <= 0 || input.balanceCents <= 0) {
    return {
      extraMonthlyCents: 0,
      simulation: simulateMonthByMonth({ ...input, extraPaymentCents: 0, maxMonths: 0 }),
    };
  }

  const baseline = simulateMonthByMonth({
    ...input,
    extraPaymentCents: 0,
  });

  if (baseline.months <= targetMonths) {
    return { extraMonthlyCents: 0, simulation: baseline };
  }

  let lo = 0;
  let hi = input.balanceCents;
  let bestExtra = hi;

  for (let iter = 0; iter < 40; iter += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const sim = simulateMonthByMonth({
      ...input,
      extraPaymentCents: mid,
      maxMonths: targetMonths + 1,
    });
    if (sim.months <= targetMonths) {
      bestExtra = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  const simulation = simulateMonthByMonth({
    ...input,
    extraPaymentCents: bestExtra,
  });

  return { extraMonthlyCents: bestExtra, simulation };
}

/** Compara cenários: atual, meta por data e extra fixo. */
export function comparePayoffStrategies(input: {
  balanceCents: number;
  system: AmortizationSystem;
  annualRateBps?: number;
  installmentAmountCents?: number;
  amortizationCents?: number;
  firstDueOn: string;
  targetDate?: string;
  extraPaymentCents?: number;
  fromDate?: string;
}): PayoffStrategyComparison[] {
  const baseline = simulateMonthByMonth({
    balanceCents: input.balanceCents,
    system: input.system,
    annualRateBps: input.annualRateBps,
    installmentAmountCents: input.installmentAmountCents,
    amortizationCents: input.amortizationCents,
    extraPaymentCents: 0,
    firstDueOn: input.firstDueOn,
  });

  const strategies: PayoffStrategyComparison[] = [
    {
      label: 'Cronograma atual',
      months: baseline.months,
      totalInterestCents: baseline.totalInterestCents,
      totalPaidCents: baseline.totalPaidCents,
      extraMonthlyCents: 0,
      interestSavedCents: 0,
    },
  ];

  if (input.targetDate) {
    const byDate = simulatePayoffByTargetDate({
      balanceCents: input.balanceCents,
      system: input.system,
      annualRateBps: input.annualRateBps,
      installmentAmountCents: input.installmentAmountCents,
      amortizationCents: input.amortizationCents,
      firstDueOn: input.firstDueOn,
      targetDate: input.targetDate,
      fromDate: input.fromDate,
    });
    strategies.push({
      label: `Quitar até ${input.targetDate}`,
      months: byDate.simulation.months,
      totalInterestCents: byDate.simulation.totalInterestCents,
      totalPaidCents: byDate.simulation.totalPaidCents,
      extraMonthlyCents: byDate.extraMonthlyCents,
      interestSavedCents: baseline.totalInterestCents - byDate.simulation.totalInterestCents,
    });
  }

  if (input.extraPaymentCents != null && input.extraPaymentCents > 0) {
    const withExtra = simulatePayoffWithExtraPayment({
      balanceCents: input.balanceCents,
      system: input.system,
      annualRateBps: input.annualRateBps,
      installmentAmountCents: input.installmentAmountCents,
      amortizationCents: input.amortizationCents,
      extraPaymentCents: input.extraPaymentCents,
      firstDueOn: input.firstDueOn,
    });
    strategies.push({
      label: `+${input.extraPaymentCents} centavos/mês extra`,
      months: withExtra.months,
      totalInterestCents: withExtra.totalInterestCents,
      totalPaidCents: withExtra.totalPaidCents,
      extraMonthlyCents: input.extraPaymentCents,
      interestSavedCents: baseline.totalInterestCents - withExtra.totalInterestCents,
    });
  }

  return strategies;
}
