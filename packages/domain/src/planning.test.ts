import { describe, expect, it } from 'vitest';
import {
  analyzeContributionSchedule,
  applyGapToLastContribution,
  buildMonthlyContributionSchedule,
  comparePayoffStrategies,
  computeMonthlySavingsNeeded,
  computePlanProgress,
  defaultAmortizationForCategory,
  monthsUntil,
  simulatePayoffByTargetDate,
  simulatePayoffWithExtraPayment,
  sumPlanItems,
} from './planning';

describe('sumPlanItems', () => {
  it('soma valores em centavos', () => {
    expect(sumPlanItems([{ amountCents: 500_000 }, { amountCents: 300_000 }])).toBe(800_000);
  });
});

describe('computePlanProgress', () => {
  it('calcula percentual e restante', () => {
    const p = computePlanProgress(250_000, 1_000_000);
    expect(p.progressPercent).toBe(25);
    expect(p.remainingCents).toBe(750_000);
    expect(p.isComplete).toBe(false);
  });

  it('marca completo quando saldo >= meta', () => {
    const p = computePlanProgress(1_000_000, 800_000);
    expect(p.isComplete).toBe(true);
    expect(p.remainingCents).toBe(0);
  });
});

describe('computeMonthlySavingsNeeded', () => {
  it('divide restante pelos meses', () => {
    const monthly = computeMonthlySavingsNeeded({
      targetCents: 1_000_000,
      savedCents: 200_000,
      targetDate: '2027-06-01',
      fromDate: '2026-06-01',
    });
    expect(monthly).toBe(Math.ceil(800_000 / 12));
  });
});

describe('monthsUntil', () => {
  it('conta meses entre datas', () => {
    expect(monthsUntil('2027-01-01', '2026-01-01')).toBe(12);
    expect(monthsUntil('2026-01-01', '2026-06-01')).toBe(0);
  });
});

describe('defaultAmortizationForCategory', () => {
  it('sugere SAC para imóvel e Price para veículo', () => {
    expect(defaultAmortizationForCategory('real_estate')).toBe('sac');
    expect(defaultAmortizationForCategory('vehicle')).toBe('price');
    expect(defaultAmortizationForCategory('other')).toBe('fixed');
  });
});

describe('simulatePayoffWithExtraPayment', () => {
  it('reduz prazo com amortização extra', () => {
    const baseline = simulatePayoffWithExtraPayment({
      balanceCents: 50_000_00,
      system: 'price',
      annualRateBps: 1200,
      installmentAmountCents: 1_200_00,
      extraPaymentCents: 0,
      firstDueOn: '2026-02-01',
    });
    const withExtra = simulatePayoffWithExtraPayment({
      balanceCents: 50_000_00,
      system: 'price',
      annualRateBps: 1200,
      installmentAmountCents: 1_200_00,
      extraPaymentCents: 500_00,
      firstDueOn: '2026-02-01',
    });
    expect(withExtra.months).toBeLessThan(baseline.months);
    expect(withExtra.totalInterestCents).toBeLessThan(baseline.totalInterestCents);
  });
});

describe('simulatePayoffByTargetDate', () => {
  it('encontra extra mensal para meta de prazo', () => {
    const result = simulatePayoffByTargetDate({
      balanceCents: 30_000_00,
      system: 'price',
      annualRateBps: 1200,
      installmentAmountCents: 800_00,
      firstDueOn: '2026-02-01',
      targetDate: '2028-02-01',
      fromDate: '2026-02-01',
    });
    expect(result.extraMonthlyCents).toBeGreaterThanOrEqual(0);
    expect(result.simulation.months).toBeLessThanOrEqual(monthsUntil('2028-02-01', '2026-02-01'));
  });
});

describe('analyzeContributionSchedule', () => {
  it('calcula gap quando aportes não cobrem meta', () => {
    const analysis = analyzeContributionSchedule({
      targetCents: 1_000_000,
      savedCents: 0,
      contributions: Array.from({ length: 10 }, () => ({ amountCents: 80_000 })),
    });
    expect(analysis.plannedCents).toBe(800_000);
    expect(analysis.gapCents).toBe(200_000);
    expect(analysis.meetsTarget).toBe(false);
  });

  it('marca meta atingida quando cronograma cobre', () => {
    const analysis = analyzeContributionSchedule({
      targetCents: 800_000,
      savedCents: 0,
      contributions: Array.from({ length: 10 }, () => ({ amountCents: 80_000 })),
    });
    expect(analysis.meetsTarget).toBe(true);
    expect(analysis.gapCents).toBe(0);
  });
});

describe('buildMonthlyContributionSchedule', () => {
  it('gera N meses com valor fixo', () => {
    const rows = buildMonthlyContributionSchedule({
      startOn: '2026-02-01',
      monthCount: 3,
      monthlyCents: 50_000,
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.amountCents === 50_000)).toBe(true);
    expect(rows[2]?.dueOn).toBe('2026-04-01');
  });
});

describe('applyGapToLastContribution', () => {
  it('ajusta último mês para fechar gap', () => {
    const base = buildMonthlyContributionSchedule({
      startOn: '2026-01-01',
      monthCount: 2,
      monthlyCents: 80_000,
    });
    const adjusted = applyGapToLastContribution(base, 20_000);
    expect(adjusted[1]?.amountCents).toBe(100_000);
  });
});

describe('comparePayoffStrategies', () => {
  it('retorna baseline e cenários adicionais', () => {
    const strategies = comparePayoffStrategies({
      balanceCents: 40_000_00,
      system: 'price',
      annualRateBps: 1200,
      installmentAmountCents: 1_000_00,
      firstDueOn: '2026-03-01',
      targetDate: '2029-03-01',
      extraPaymentCents: 200_00,
      fromDate: '2026-03-01',
    });
    expect(strategies.length).toBeGreaterThanOrEqual(2);
    expect(strategies[0]?.label).toBe('Cronograma atual');
  });
});
