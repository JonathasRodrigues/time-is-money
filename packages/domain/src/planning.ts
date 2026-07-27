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

export const MONTH_LABEL_PT: Record<number, string> = {
  1: 'janeiro',
  2: 'fevereiro',
  3: 'março',
  4: 'abril',
  5: 'maio',
  6: 'junho',
  7: 'julho',
  8: 'agosto',
  9: 'setembro',
  10: 'outubro',
  11: 'novembro',
  12: 'dezembro',
};

/** Templates padrão de itens para planos de viagem. */
export const TRAVEL_ITEM_TEMPLATES: ReadonlyArray<{ label: string }> = [
  { label: 'Passagem' },
  { label: 'Hospedagem' },
  { label: 'Alimentação' },
  { label: 'Seguro viagem' },
  { label: 'Deslocamento local' },
  { label: 'Visto / documentação' },
];

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

export type PayoffExtraRule =
  | { type: 'monthly_cents'; cents: number }
  | { type: 'extra_installments'; count: number }
  | { type: 'annual_lump'; month: number; cents: number }
  | { type: 'every_n_months'; everyMonths: number; cents: number; offsetMonths?: number }
  | { type: 'one_time'; atMonth: number; cents: number };

export type PayoffApplicationMode = 'reduce_term' | 'reduce_payment';

export type SavingsLumpRule =
  | { type: 'annual_lump'; month: number; cents: number }
  | { type: 'every_n_months'; everyMonths: number; cents: number; offsetMonths?: number }
  | { type: 'one_time'; atMonth: number; cents: number };

export interface PayoffSimulationResult {
  months: number;
  totalPaidCents: number;
  totalInterestCents: number;
  totalPrincipalCents: number;
  totalExtraCents: number;
  averageExtraCents: number;
  applicationMode: PayoffApplicationMode;
  schedule: AmortizationRow[];
}

export interface PayoffStrategyComparison {
  label: string;
  months: number;
  durationLabel: string;
  totalInterestCents: number;
  totalPaidCents: number;
  /** Esforço médio mensal em extras (centavos). */
  extraMonthlyCents: number;
  interestSavedCents: number;
}

export interface SavingsGoalSimulation {
  months: number;
  completionDate: string | null;
  projectedSavedCents: number;
  inflatedTargetCents: number;
  meetsTarget: boolean;
  schedule: PlanContributionRow[];
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

/** Formata prazo em anos e meses (ex.: "3 anos e 4 meses"). */
export function formatMonthsAsDuration(months: number): string {
  const total = Math.max(0, Math.floor(months));
  if (total === 0) return '0 meses';
  const years = Math.floor(total / 12);
  const rem = total % 12;
  if (years === 0) return rem === 1 ? '1 mês' : `${rem} meses`;
  if (rem === 0) return years === 1 ? '1 ano' : `${years} anos`;
  const yearPart = years === 1 ? '1 ano' : `${years} anos`;
  const monthPart = rem === 1 ? '1 mês' : `${rem} meses`;
  return `${yearPart} e ${monthPart}`;
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

/**
 * Gera cronograma mensal e soma lumps sazonais (ex.: +R$ em dezembro).
 * `lumps` usam índice 1-based do mês no cronograma (igual às regras de quitação).
 */
export function buildSeasonalContributionSchedule(input: {
  startOn: string;
  monthCount: number;
  monthlyCents: number;
  lumps?: readonly SavingsLumpRule[];
}): PlanContributionRow[] {
  const base = buildMonthlyContributionSchedule(input);
  const lumps = input.lumps ?? [];
  if (lumps.length === 0) return base;

  return base.map((row, index) => {
    const monthIndex = index + 1;
    const dueMonth = monthNumberFromIso(row.dueOn);
    let extra = 0;
    for (const rule of lumps) {
      extra += resolveSavingsLumpCents(rule, monthIndex, dueMonth);
    }
    return { dueOn: row.dueOn, amountCents: row.amountCents + extra };
  });
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

export interface InstallmentBalanceLike {
  status: string;
  principalCents: number;
  amountCents: number;
  interestCents: number;
  balanceAfterCents: number;
}

/**
 * Estima saldo residual (principal) e amortização por período a partir das parcelas.
 * Preferência: balanceAfter da última parcela paga; senão soma dos principals pendentes.
 */
export function estimateFinancingResidual(input: {
  installments: readonly InstallmentBalanceLike[];
}): { balanceCents: number; amortizationPerPeriodCents: number } {
  const pending = input.installments.filter((item) => item.status === 'pending');
  const paid = input.installments.filter((item) => item.status === 'paid');

  let balanceCents = 0;
  const lastPaid = paid[paid.length - 1];
  if (lastPaid && lastPaid.balanceAfterCents > 0) {
    balanceCents = lastPaid.balanceAfterCents;
  } else {
    balanceCents = pending.reduce((sum, item) => {
      const principal =
        item.principalCents > 0
          ? item.principalCents
          : Math.max(0, item.amountCents - item.interestCents);
      return sum + principal;
    }, 0);
  }

  const firstPending = pending[0];
  let amortizationPerPeriodCents = 0;
  if (firstPending) {
    amortizationPerPeriodCents =
      firstPending.principalCents > 0
        ? firstPending.principalCents
        : Math.max(0, firstPending.amountCents - firstPending.interestCents);
  } else if (balanceCents > 0 && pending.length > 0) {
    amortizationPerPeriodCents = roundCents(balanceCents / pending.length);
  }

  return { balanceCents, amortizationPerPeriodCents };
}

/** Valor extra equivalente a N parcelas (Price/fixed = parcela; SAC = amortização do período). */
export function extraCentsFromInstallmentCount(input: {
  count: number;
  system: AmortizationSystem;
  installmentAmountCents?: number;
  amortizationCents?: number;
}): number {
  const count = Math.max(0, Math.floor(input.count));
  if (count === 0) return 0;
  if (input.system === 'sac') {
    const amort = Math.max(0, input.amortizationCents ?? 0);
    return count * amort;
  }
  return count * Math.max(0, input.installmentAmountCents ?? 0);
}

/** Rótulo legível de uma regra de amortização extra. */
export function labelPayoffExtraRule(rule: PayoffExtraRule): string {
  switch (rule.type) {
    case 'monthly_cents':
      return `+${formatCentsShort(rule.cents)}/mês`;
    case 'extra_installments': {
      const n = Math.max(0, Math.floor(rule.count));
      if (n === 1) return '+1 parcela/mês';
      return `+${n} parcelas/mês`;
    }
    case 'annual_lump': {
      const monthName = MONTH_LABEL_PT[rule.month] ?? `mês ${rule.month}`;
      return `+${formatCentsShort(rule.cents)} em ${monthName}`;
    }
    case 'every_n_months': {
      const every = Math.max(1, Math.floor(rule.everyMonths));
      if (every === 12) return `+${formatCentsShort(rule.cents)} a cada ano`;
      if (every === 24) return `+${formatCentsShort(rule.cents)} a cada 2 anos (FGTS)`;
      return `+${formatCentsShort(rule.cents)} a cada ${every} meses`;
    }
    case 'one_time':
      return `+${formatCentsShort(rule.cents)} no mês ${Math.max(1, Math.floor(rule.atMonth))}`;
    default: {
      const _exhaustive: never = rule;
      return String(_exhaustive);
    }
  }
}

/** Junta rótulos de várias regras. */
export function labelPayoffExtraRules(rules: readonly PayoffExtraRule[]): string {
  if (rules.length === 0) return 'Sem amortização extra';
  return rules.map((rule) => labelPayoffExtraRule(rule)).join(' + ');
}

function formatCentsShort(cents: number): string {
  const value = Math.max(0, cents) / 100;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

function monthNumberFromIso(isoDate: string): number {
  const parts = isoDate.split('-').map(Number);
  const month = parts[1];
  return month != null && month >= 1 && month <= 12 ? month : 0;
}

function resolveExtraCentsForMonth(input: {
  rules: readonly PayoffExtraRule[];
  monthIndex: number;
  dueOn: string;
  system: AmortizationSystem;
  installmentAmountCents?: number;
  amortizationCents?: number;
}): number {
  const dueMonth = monthNumberFromIso(input.dueOn);
  let total = 0;
  for (const rule of input.rules) {
    switch (rule.type) {
      case 'monthly_cents':
        total += Math.max(0, rule.cents);
        break;
      case 'extra_installments':
        total += extraCentsFromInstallmentCount({
          count: rule.count,
          system: input.system,
          installmentAmountCents: input.installmentAmountCents,
          amortizationCents: input.amortizationCents,
        });
        break;
      case 'annual_lump':
        if (dueMonth === clampMonth(rule.month)) {
          total += Math.max(0, rule.cents);
        }
        break;
      case 'every_n_months': {
        const every = Math.max(1, Math.floor(rule.everyMonths));
        const offset = Math.max(0, Math.floor(rule.offsetMonths ?? 0));
        if (input.monthIndex > offset && (input.monthIndex - offset) % every === 0) {
          total += Math.max(0, rule.cents);
        }
        break;
      }
      case 'one_time':
        if (input.monthIndex === Math.max(1, Math.floor(rule.atMonth))) {
          total += Math.max(0, rule.cents);
        }
        break;
      default: {
        const _exhaustive: never = rule;
        void _exhaustive;
      }
    }
  }
  return total;
}

function resolveSavingsLumpCents(
  rule: SavingsLumpRule,
  monthIndex: number,
  dueMonth: number,
): number {
  switch (rule.type) {
    case 'annual_lump':
      return dueMonth === clampMonth(rule.month) ? Math.max(0, rule.cents) : 0;
    case 'every_n_months': {
      const every = Math.max(1, Math.floor(rule.everyMonths));
      const offset = Math.max(0, Math.floor(rule.offsetMonths ?? 0));
      if (monthIndex > offset && (monthIndex - offset) % every === 0) {
        return Math.max(0, rule.cents);
      }
      return 0;
    }
    case 'one_time':
      return monthIndex === Math.max(1, Math.floor(rule.atMonth)) ? Math.max(0, rule.cents) : 0;
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

function clampMonth(month: number): number {
  return Math.min(12, Math.max(1, Math.floor(month)));
}

function pricePaymentCents(balanceCents: number, months: number, monthlyInterest: number): number {
  if (balanceCents <= 0 || months <= 0) return 0;
  if (monthlyInterest <= 0) return roundCents(balanceCents / months);
  const factor = (1 + monthlyInterest) ** months;
  return roundCents((balanceCents * (monthlyInterest * factor)) / (factor - 1));
}

export interface SimulatePayoffPlanInput {
  balanceCents: number;
  system: AmortizationSystem;
  annualRateBps?: number;
  installmentAmountCents?: number;
  amortizationCents?: number;
  firstDueOn: string;
  rules?: readonly PayoffExtraRule[];
  applicationMode?: PayoffApplicationMode;
  maxMonths?: number;
  /** Prazo residual a preservar no modo reduce_payment (default = baseline sem extras). */
  remainingTermMonths?: number;
}

/** Simula quitação com regras compostas de amortização extra. */
export function simulatePayoffPlan(input: SimulatePayoffPlanInput): PayoffSimulationResult {
  const applicationMode = input.applicationMode ?? 'reduce_term';
  const rules = input.rules ?? [];
  const i = monthlyRate(input.annualRateBps);
  const maxMonths = input.maxMonths ?? 600;

  let remainingTerm =
    input.remainingTermMonths != null && input.remainingTermMonths > 0
      ? Math.floor(input.remainingTermMonths)
      : null;

  if (applicationMode === 'reduce_payment' && remainingTerm == null) {
    const baseline = simulatePayoffPlan({
      ...input,
      rules: [],
      applicationMode: 'reduce_term',
      remainingTermMonths: undefined,
      maxMonths,
    });
    remainingTerm = Math.max(1, baseline.months);
  }

  let balance = Math.max(0, input.balanceCents);
  let currentPmt = Math.max(0, input.installmentAmountCents ?? 0);
  let currentAmort = Math.max(0, input.amortizationCents ?? 0);
  const schedule: AmortizationRow[] = [];
  let totalInterestCents = 0;
  let totalPaidCents = 0;
  let totalExtraCents = 0;

  const loopLimit =
    applicationMode === 'reduce_payment' && remainingTerm != null
      ? Math.min(maxMonths, remainingTerm)
      : maxMonths;

  for (let n = 1; n <= loopLimit && balance > 0; n += 1) {
    const dueOn = addMonthsLocal(input.firstDueOn, n - 1);
    const interestCents = roundCents(balance * i);
    let principalFromPayment = 0;
    let amountCents = 0;

    if (input.system === 'sac') {
      const amort =
        currentAmort > 0
          ? currentAmort
          : roundCents(balance / Math.max(1, (remainingTerm ?? maxMonths) - n + 1));
      principalFromPayment = Math.min(balance, amort);
      amountCents = interestCents + principalFromPayment;
    } else {
      const pmt = currentPmt;
      principalFromPayment = Math.max(0, Math.min(balance, pmt - interestCents));
      if (principalFromPayment <= 0 && pmt > 0) {
        principalFromPayment = Math.min(balance, pmt);
      }
      amountCents = interestCents + principalFromPayment;
    }

    const extraPrincipal = Math.min(
      Math.max(0, balance - principalFromPayment),
      resolveExtraCentsForMonth({
        rules,
        monthIndex: n,
        dueOn,
        system: input.system,
        installmentAmountCents: currentPmt > 0 ? currentPmt : input.installmentAmountCents,
        amortizationCents: currentAmort > 0 ? currentAmort : input.amortizationCents,
      }),
    );

    const totalPrincipal = principalFromPayment + extraPrincipal;
    const totalAmount = amountCents + extraPrincipal;
    balance -= totalPrincipal;
    totalInterestCents += interestCents;
    totalPaidCents += totalAmount;
    totalExtraCents += extraPrincipal;

    schedule.push({
      number: n,
      dueOn,
      amountCents: totalAmount,
      interestCents,
      principalCents: totalPrincipal,
      balanceAfterCents: Math.max(0, balance),
    });

    if (applicationMode === 'reduce_payment' && remainingTerm != null && balance > 0) {
      const monthsLeft = remainingTerm - n;
      if (monthsLeft > 0) {
        if (input.system === 'sac') {
          currentAmort = roundCents(balance / monthsLeft);
        } else {
          currentPmt = pricePaymentCents(balance, monthsLeft, i);
        }
      }
    }
  }

  const months = schedule.length;
  return {
    months,
    totalPaidCents,
    totalInterestCents,
    totalPrincipalCents: input.balanceCents - Math.max(0, balance),
    totalExtraCents,
    averageExtraCents: months > 0 ? roundCents(totalExtraCents / months) : 0,
    applicationMode,
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
  applicationMode?: PayoffApplicationMode;
}): PayoffSimulationResult {
  const rules: PayoffExtraRule[] =
    input.extraPaymentCents > 0
      ? [{ type: 'monthly_cents', cents: Math.max(0, input.extraPaymentCents) }]
      : [];
  return simulatePayoffPlan({
    balanceCents: input.balanceCents,
    system: input.system,
    annualRateBps: input.annualRateBps,
    installmentAmountCents: input.installmentAmountCents,
    amortizationCents: input.amortizationCents,
    firstDueOn: input.firstDueOn,
    rules,
    applicationMode: input.applicationMode,
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
  baseRules?: readonly PayoffExtraRule[];
  applicationMode?: PayoffApplicationMode;
}): { extraMonthlyCents: number; simulation: PayoffSimulationResult } {
  const targetMonths = monthsUntil(input.targetDate, input.fromDate);
  const baseRules = input.baseRules ?? [];
  const applicationMode = input.applicationMode ?? 'reduce_term';

  if (targetMonths <= 0 || input.balanceCents <= 0) {
    return {
      extraMonthlyCents: 0,
      simulation: simulatePayoffPlan({
        ...input,
        rules: baseRules,
        applicationMode,
        maxMonths: 0,
      }),
    };
  }

  const withBase = simulatePayoffPlan({
    ...input,
    rules: baseRules,
    applicationMode,
  });

  if (withBase.months <= targetMonths) {
    return { extraMonthlyCents: 0, simulation: withBase };
  }

  let lo = 0;
  let hi = input.balanceCents;
  let bestExtra = hi;

  for (let iter = 0; iter < 40; iter += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const rules: PayoffExtraRule[] = [...baseRules, { type: 'monthly_cents', cents: mid }];
    const sim = simulatePayoffPlan({
      ...input,
      rules,
      applicationMode,
      maxMonths: targetMonths + 1,
    });
    if (sim.months <= targetMonths) {
      bestExtra = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  const simulation = simulatePayoffPlan({
    ...input,
    rules: [...baseRules, { type: 'monthly_cents', cents: bestExtra }],
    applicationMode,
  });

  return { extraMonthlyCents: bestExtra, simulation };
}

/** Compara cenários: atual, meta por data e regras compostas. */
export function comparePayoffStrategies(input: {
  balanceCents: number;
  system: AmortizationSystem;
  annualRateBps?: number;
  installmentAmountCents?: number;
  amortizationCents?: number;
  firstDueOn: string;
  targetDate?: string;
  extraPaymentCents?: number;
  rules?: readonly PayoffExtraRule[];
  applicationMode?: PayoffApplicationMode;
  fromDate?: string;
}): PayoffStrategyComparison[] {
  const applicationMode = input.applicationMode ?? 'reduce_term';
  const baseline = simulatePayoffPlan({
    balanceCents: input.balanceCents,
    system: input.system,
    annualRateBps: input.annualRateBps,
    installmentAmountCents: input.installmentAmountCents,
    amortizationCents: input.amortizationCents,
    firstDueOn: input.firstDueOn,
    rules: [],
    applicationMode: 'reduce_term',
  });

  const strategies: PayoffStrategyComparison[] = [
    {
      label: 'Cronograma atual',
      months: baseline.months,
      durationLabel: formatMonthsAsDuration(baseline.months),
      totalInterestCents: baseline.totalInterestCents,
      totalPaidCents: baseline.totalPaidCents,
      extraMonthlyCents: 0,
      interestSavedCents: 0,
    },
  ];

  const composedRules: PayoffExtraRule[] = [...(input.rules ?? [])];
  if (input.extraPaymentCents != null && input.extraPaymentCents > 0) {
    composedRules.push({ type: 'monthly_cents', cents: input.extraPaymentCents });
  }

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
      baseRules: composedRules,
      applicationMode,
    });
    strategies.push({
      label: `Quitar até ${input.targetDate}`,
      months: byDate.simulation.months,
      durationLabel: formatMonthsAsDuration(byDate.simulation.months),
      totalInterestCents: byDate.simulation.totalInterestCents,
      totalPaidCents: byDate.simulation.totalPaidCents,
      extraMonthlyCents: byDate.simulation.averageExtraCents,
      interestSavedCents: baseline.totalInterestCents - byDate.simulation.totalInterestCents,
    });
  }

  if (composedRules.length > 0) {
    const withRules = simulatePayoffPlan({
      balanceCents: input.balanceCents,
      system: input.system,
      annualRateBps: input.annualRateBps,
      installmentAmountCents: input.installmentAmountCents,
      amortizationCents: input.amortizationCents,
      firstDueOn: input.firstDueOn,
      rules: composedRules,
      applicationMode,
    });
    strategies.push({
      label: labelPayoffExtraRules(composedRules),
      months: withRules.months,
      durationLabel: formatMonthsAsDuration(withRules.months),
      totalInterestCents: withRules.totalInterestCents,
      totalPaidCents: withRules.totalPaidCents,
      extraMonthlyCents: withRules.averageExtraCents,
      interestSavedCents: baseline.totalInterestCents - withRules.totalInterestCents,
    });
  }

  return strategies;
}

/**
 * Projeta quanto tempo leva para atingir uma meta de poupança,
 * com aporte mensal, lumps sazonais, rendimento e inflação opcionais.
 */
export function simulateSavingsGoal(input: {
  targetCents: number;
  savedCents: number;
  monthlyContributionCents: number;
  lumps?: readonly SavingsLumpRule[];
  annualYieldBps?: number;
  annualInflationBps?: number;
  fromDate: string;
  maxMonths?: number;
}): SavingsGoalSimulation {
  const maxMonths = input.maxMonths ?? 600;
  const monthlyYield = monthlyRate(input.annualYieldBps);
  const monthlyInflation = monthlyRate(input.annualInflationBps);
  let saved = Math.max(0, input.savedCents);
  let target = Math.max(0, input.targetCents);
  const schedule: PlanContributionRow[] = [];
  const lumps = input.lumps ?? [];

  if (target <= 0 || saved >= target) {
    return {
      months: 0,
      completionDate: input.fromDate,
      projectedSavedCents: saved,
      inflatedTargetCents: target,
      meetsTarget: true,
      schedule: [],
    };
  }

  for (let n = 1; n <= maxMonths; n += 1) {
    const dueOn = addMonthsLocal(input.fromDate, n - 1);
    const dueMonth = monthNumberFromIso(dueOn);
    let contribution = Math.max(0, input.monthlyContributionCents);
    for (const rule of lumps) {
      contribution += resolveSavingsLumpCents(rule, n, dueMonth);
    }

    if (monthlyYield > 0) {
      saved = roundCents(saved * (1 + monthlyYield));
    }
    if (monthlyInflation > 0) {
      target = roundCents(target * (1 + monthlyInflation));
    }

    saved += contribution;
    schedule.push({ dueOn, amountCents: contribution });

    if (saved >= target) {
      return {
        months: n,
        completionDate: dueOn,
        projectedSavedCents: saved,
        inflatedTargetCents: target,
        meetsTarget: true,
        schedule,
      };
    }
  }

  return {
    months: schedule.length,
    completionDate: null,
    projectedSavedCents: saved,
    inflatedTargetCents: target,
    meetsTarget: false,
    schedule,
  };
}
