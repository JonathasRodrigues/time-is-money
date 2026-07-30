import { describe, expect, it } from 'vitest';
import {
  analyzeContributionSchedule,
  applyGapToLastContribution,
  buildMonthlyContributionSchedule,
  buildSeasonalContributionSchedule,
  comparePayoffStrategies,
  computeMonthlySavingsNeeded,
  computePlanProgress,
  defaultAmortizationForCategory,
  estimateFinancingResidual,
  extraCentsFromInstallmentCount,
  formatMonthsAsDuration,
  labelPayoffExtraRules,
  monthsUntil,
  pickTrailingInstallmentsForAmortization,
  recommendPayoffPlansForTargetDate,
  redistributeContributionsToTarget,
  simulatePayoffByTargetDate,
  simulatePayoffPlan,
  simulatePayoffWithExtraPayment,
  simulateSavingsGoal,
  simulateSingleAmortization,
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

describe('formatMonthsAsDuration', () => {
  it('formata anos e meses', () => {
    expect(formatMonthsAsDuration(0)).toBe('0 meses');
    expect(formatMonthsAsDuration(1)).toBe('1 mês');
    expect(formatMonthsAsDuration(14)).toBe('1 ano e 2 meses');
    expect(formatMonthsAsDuration(24)).toBe('2 anos');
  });
});

describe('defaultAmortizationForCategory', () => {
  it('sugere SAC para imóvel e Price para veículo', () => {
    expect(defaultAmortizationForCategory('real_estate')).toBe('sac');
    expect(defaultAmortizationForCategory('vehicle')).toBe('price');
    expect(defaultAmortizationForCategory('other')).toBe('fixed');
  });
});

describe('extraCentsFromInstallmentCount', () => {
  it('multiplica parcela no Price e amortização no SAC', () => {
    expect(
      extraCentsFromInstallmentCount({
        count: 2,
        system: 'price',
        installmentAmountCents: 1_000_00,
      }),
    ).toBe(2_000_00);
    expect(
      extraCentsFromInstallmentCount({
        count: 3,
        system: 'sac',
        amortizationCents: 800_00,
      }),
    ).toBe(2_400_00);
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

describe('simulatePayoffPlan — regras compostas', () => {
  const base = {
    balanceCents: 100_000_00,
    system: 'price' as const,
    annualRateBps: 1200,
    installmentAmountCents: 1_500_00,
    firstDueOn: '2026-01-15',
  };

  it('amortizar 2 parcelas/mês reduz o prazo em anos', () => {
    const baseline = simulatePayoffPlan({ ...base, rules: [] });
    const withTwo = simulatePayoffPlan({
      ...base,
      rules: [{ type: 'extra_installments', count: 2 }],
    });
    expect(withTwo.months).toBeLessThan(baseline.months);
    expect(withTwo.months).toBeLessThan(baseline.months / 2 + 6);
    expect(formatMonthsAsDuration(withTwo.months)).toMatch(/ano|mês/);
  });

  it('combina 3 parcelas/mês + aporte de dezembro', () => {
    const onlyInstallments = simulatePayoffPlan({
      ...base,
      rules: [{ type: 'extra_installments', count: 3 }],
    });
    const withDecember = simulatePayoffPlan({
      ...base,
      rules: [
        { type: 'extra_installments', count: 3 },
        { type: 'annual_lump', month: 12, cents: 10_000_00 },
      ],
    });
    expect(withDecember.months).toBeLessThanOrEqual(onlyInstallments.months);
    expect(withDecember.totalInterestCents).toBeLessThanOrEqual(
      onlyInstallments.totalInterestCents,
    );
    expect(withDecember.totalExtraCents).toBeGreaterThan(onlyInstallments.totalExtraCents);
  });

  it('aplica FGTS a cada 24 meses', () => {
    const baseline = simulatePayoffPlan({ ...base, rules: [] });
    const withFgts = simulatePayoffPlan({
      ...base,
      rules: [{ type: 'every_n_months', everyMonths: 24, cents: 20_000_00 }],
    });
    expect(withFgts.months).toBeLessThan(baseline.months);
    expect(withFgts.totalExtraCents).toBeGreaterThan(0);
  });

  it('reduzir prazo economiza mais juros que reduzir parcela', () => {
    const rules = [
      { type: 'extra_installments' as const, count: 1 },
      { type: 'annual_lump' as const, month: 12, cents: 5_000_00 },
    ];
    const reduceTerm = simulatePayoffPlan({
      ...base,
      rules,
      applicationMode: 'reduce_term',
    });
    const reducePayment = simulatePayoffPlan({
      ...base,
      rules,
      applicationMode: 'reduce_payment',
    });
    expect(reduceTerm.months).toBeLessThan(reducePayment.months);
    expect(reduceTerm.totalInterestCents).toBeLessThan(reducePayment.totalInterestCents);
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

describe('simulateSingleAmortization', () => {
  const priceBase = {
    balanceCents: 100_000_00,
    system: 'price' as const,
    annualRateBps: 1200,
    installmentAmountCents: 1_500_00,
    firstDueOn: '2026-01-15',
    extraCents: 20_000_00,
  };

  const sacBase = {
    balanceCents: 120_000_00,
    system: 'sac' as const,
    annualRateBps: 960,
    amortizationCents: 1_000_00,
    installmentAmountCents: 1_500_00,
    firstDueOn: '2026-03-01',
    extraCents: 24_000_00,
  };

  it('Price reduce_term: mantém parcela e encurta prazo', () => {
    const result = simulateSingleAmortization({
      ...priceBase,
      applicationMode: 'reduce_term',
    });
    expect(result.paymentAfterCents).toBe(result.paymentBeforeCents);
    expect(result.paymentBeforeCents).toBe(1_500_00);
    expect(result.monthsAfter).toBeLessThan(result.monthsBefore);
    expect(result.interestSavedCents).toBeGreaterThan(0);
    expect(result.payoffDateAfter).not.toBeNull();
    expect(result.scheduleAfter.length).toBe(result.monthsAfter);
  });

  it('Price reduce_payment: mantém prazo e reduz parcela', () => {
    const result = simulateSingleAmortization({
      ...priceBase,
      applicationMode: 'reduce_payment',
    });
    expect(result.monthsAfter).toBe(result.monthsBefore);
    expect(result.paymentAfterCents).toBeLessThan(result.paymentBeforeCents);
    expect(result.interestSavedCents).toBeGreaterThan(0);
  });

  it('Price: reduzir prazo economiza mais juros que reduzir parcela', () => {
    const reduceTerm = simulateSingleAmortization({
      ...priceBase,
      applicationMode: 'reduce_term',
    });
    const reducePayment = simulateSingleAmortization({
      ...priceBase,
      applicationMode: 'reduce_payment',
    });
    expect(reduceTerm.interestSavedCents).toBeGreaterThan(reducePayment.interestSavedCents);
    expect(reduceTerm.monthsAfter).toBeLessThan(reducePayment.monthsAfter);
  });

  it('SAC reduce_term: mantém amortização periódica e encurta prazo', () => {
    const result = simulateSingleAmortization({
      ...sacBase,
      applicationMode: 'reduce_term',
    });
    expect(result.paymentBeforeCents).toBe(1_000_00);
    expect(result.paymentAfterCents).toBe(1_000_00);
    expect(result.monthsAfter).toBeLessThan(result.monthsBefore);
    expect(result.interestSavedCents).toBeGreaterThan(0);
  });

  it('SAC reduce_payment: mantém prazo e reduz amortização periódica', () => {
    const result = simulateSingleAmortization({
      ...sacBase,
      applicationMode: 'reduce_payment',
    });
    expect(result.monthsAfter).toBe(result.monthsBefore);
    expect(result.paymentAfterCents).toBeLessThan(result.paymentBeforeCents);
    expect(result.interestSavedCents).toBeGreaterThan(0);
  });

  it('sem extra: cenário igual ao baseline', () => {
    const result = simulateSingleAmortization({
      ...priceBase,
      extraCents: 0,
      applicationMode: 'reduce_term',
    });
    expect(result.monthsAfter).toBe(result.monthsBefore);
    expect(result.interestSavedCents).toBe(0);
    expect(result.paymentAfterCents).toBe(result.paymentBeforeCents);
    expect(result.trailingSelection).toBeNull();
  });

  it('com cronograma: escolhe parcelas do final até o valor', () => {
    const installments = Array.from({ length: 10 }, (_, index) => ({
      number: index + 1,
      dueOn: `2026-${String(index + 1).padStart(2, '0')}-15`,
      principalCents: 10_000_00,
      status: 'pending',
    }));
    const result = simulateSingleAmortization({
      ...priceBase,
      extraCents: 25_000_00,
      applicationMode: 'reduce_term',
      installments,
    });
    expect(result.trailingSelection).not.toBeNull();
    expect(result.trailingSelection?.appliedPrincipalCents).toBe(25_000_00);
    expect(result.trailingSelection?.fromNumber).toBe(8);
    expect(result.trailingSelection?.toNumber).toBe(10);
    expect(result.trailingSelection?.fullyRemovedCount).toBe(2);
    expect(result.trailingSelection?.selected.some((row) => row.partial)).toBe(true);
    expect(result.extraCents).toBe(25_000_00);
    expect(result.monthsAfter).toBeLessThan(result.monthsBefore);
  });
});

describe('pickTrailingInstallmentsForAmortization', () => {
  it('pega do final e permite parcial na borda', () => {
    const pick = pickTrailingInstallmentsForAmortization({
      targetPrincipalCents: 25_000_00,
      installments: [
        { number: 1, dueOn: '2026-01-01', principalCents: 10_000_00, status: 'pending' },
        { number: 2, dueOn: '2026-02-01', principalCents: 10_000_00, status: 'pending' },
        { number: 3, dueOn: '2026-03-01', principalCents: 10_000_00, status: 'pending' },
      ],
    });
    expect(pick.appliedPrincipalCents).toBe(25_000_00);
    expect(pick.selected.map((row) => row.number)).toEqual([1, 2, 3]);
    expect(pick.selected.find((row) => row.number === 1)?.partial).toBe(true);
    expect(pick.selected.find((row) => row.number === 1)?.principalCents).toBe(5_000_00);
    expect(pick.fullyRemovedCount).toBe(2);
  });
});

describe('recommendPayoffPlansForTargetDate', () => {
  it('sugere planos para quitar em prazo menor', () => {
    const plans = recommendPayoffPlansForTargetDate({
      balanceCents: 100_000_00,
      system: 'price',
      annualRateBps: 1200,
      installmentAmountCents: 1_500_00,
      firstDueOn: '2026-01-15',
      targetDate: '2031-01-15',
      fromDate: '2026-01-15',
    });
    expect(plans.length).toBeGreaterThan(0);
    const meeting = plans.filter((plan) => plan.meetsTarget);
    expect(meeting.length).toBeGreaterThan(0);
    expect(
      meeting.some((plan) => plan.rules.some((rule) => rule.type === 'extra_installments')),
    ).toBe(true);
    expect(meeting.some((plan) => plan.rules.some((rule) => rule.type === 'monthly_cents'))).toBe(
      true,
    );
  });

  it('diz que o cronograma atual basta quando a meta é folgada', () => {
    const plans = recommendPayoffPlansForTargetDate({
      balanceCents: 10_000_00,
      system: 'price',
      annualRateBps: 1200,
      installmentAmountCents: 2_000_00,
      firstDueOn: '2026-01-15',
      targetDate: '2040-01-15',
      fromDate: '2026-01-15',
    });
    expect(plans[0]?.id).toBe('already-on-track');
  });
});

describe('estimateFinancingResidual', () => {
  it('usa balanceAfter da última parcela paga', () => {
    const result = estimateFinancingResidual({
      installments: [
        {
          status: 'paid',
          principalCents: 800_00,
          amountCents: 1_000_00,
          interestCents: 200_00,
          balanceAfterCents: 40_000_00,
        },
        {
          status: 'pending',
          principalCents: 810_00,
          amountCents: 1_000_00,
          interestCents: 190_00,
          balanceAfterCents: 39_190_00,
        },
      ],
    });
    expect(result.balanceCents).toBe(40_000_00);
    expect(result.amortizationPerPeriodCents).toBe(810_00);
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

describe('buildSeasonalContributionSchedule', () => {
  it('soma lump de dezembro', () => {
    const rows = buildSeasonalContributionSchedule({
      startOn: '2026-11-01',
      monthCount: 3,
      monthlyCents: 50_000,
      lumps: [{ type: 'annual_lump', month: 12, cents: 200_000 }],
    });
    expect(rows[0]?.amountCents).toBe(50_000);
    expect(rows[1]?.amountCents).toBe(250_000);
    expect(rows[2]?.amountCents).toBe(50_000);
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

describe('redistributeContributionsToTarget', () => {
  it('divide o restante da meta igualmente e joga o resto no último mês', () => {
    const base = buildMonthlyContributionSchedule({
      startOn: '2026-01-01',
      monthCount: 3,
      monthlyCents: 100_00,
    });
    const rows = redistributeContributionsToTarget({
      contributions: base,
      targetCents: 10_000_00,
      savedCents: 1_000_00,
    });
    expect(rows.map((row) => row.amountCents)).toEqual([3_000_00, 3_000_00, 3_000_00]);
  });

  it('respeita resto de divisão em centavos no último mês', () => {
    const base = buildMonthlyContributionSchedule({
      startOn: '2026-01-01',
      monthCount: 3,
      monthlyCents: 0,
    });
    const rows = redistributeContributionsToTarget({
      contributions: base,
      targetCents: 100_01,
      savedCents: 0,
    });
    expect(rows[0]?.amountCents).toBe(3_333);
    expect(rows[1]?.amountCents).toBe(3_333);
    expect(rows[2]?.amountCents).toBe(3_335);
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
      rules: [{ type: 'extra_installments', count: 1 }],
      fromDate: '2026-03-01',
    });
    expect(strategies.length).toBeGreaterThanOrEqual(2);
    expect(strategies[0]?.label).toBe('Cronograma atual');
    expect(strategies[0]?.durationLabel).toBeTruthy();
  });
});

describe('labelPayoffExtraRules', () => {
  it('descreve combinação de regras', () => {
    const label = labelPayoffExtraRules([
      { type: 'extra_installments', count: 2 },
      { type: 'annual_lump', month: 12, cents: 10_000_00 },
    ]);
    expect(label).toContain('+2 parcelas/mês');
    expect(label).toContain('dezembro');
  });
});

describe('simulateSavingsGoal', () => {
  it('projeta conclusão com aporte mensal', () => {
    const result = simulateSavingsGoal({
      targetCents: 12_000_00,
      savedCents: 0,
      monthlyContributionCents: 1_000_00,
      fromDate: '2026-01-01',
    });
    expect(result.meetsTarget).toBe(true);
    expect(result.months).toBe(12);
    expect(result.completionDate).toBe('2026-12-01');
  });

  it('acelera com lump anual em dezembro', () => {
    const plain = simulateSavingsGoal({
      targetCents: 20_000_00,
      savedCents: 0,
      monthlyContributionCents: 1_000_00,
      fromDate: '2026-01-01',
    });
    const withDec = simulateSavingsGoal({
      targetCents: 20_000_00,
      savedCents: 0,
      monthlyContributionCents: 1_000_00,
      lumps: [{ type: 'annual_lump', month: 12, cents: 5_000_00 }],
      fromDate: '2026-01-01',
    });
    expect(withDec.months).toBeLessThan(plain.months);
  });

  it('considera rendimento simples', () => {
    const noYield = simulateSavingsGoal({
      targetCents: 50_000_00,
      savedCents: 10_000_00,
      monthlyContributionCents: 500_00,
      fromDate: '2026-01-01',
    });
    const withYield = simulateSavingsGoal({
      targetCents: 50_000_00,
      savedCents: 10_000_00,
      monthlyContributionCents: 500_00,
      annualYieldBps: 1200,
      fromDate: '2026-01-01',
    });
    expect(withYield.months).toBeLessThanOrEqual(noYield.months);
  });
});
