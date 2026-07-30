import { z } from 'zod';
import { isoDateSchema } from '@tim/validators';
import { dateRangeQuerySchema } from './common';
import { yieldTypeSchema } from './wealth';
import { planKindSchema } from './planning';

export const dashboardQuerySchema = dateRangeQuerySchema;

export const attentionSeveritySchema = z.enum(['critical', 'warning', 'info', 'positive']);

export const attentionKindSchema = z.enum([
  'spike',
  'drop',
  'rebound',
  'sustained_rise',
  'vs_average',
  'new_category',
]);

export const attentionSignalSchema = z.object({
  id: z.string(),
  categoryName: z.string(),
  severity: attentionSeveritySchema,
  kind: attentionKindSchema,
  title: z.string(),
  detail: z.string(),
  deltaCents: z.number().int(),
  deltaPct: z.number().nullable(),
  series: z.array(
    z.object({
      monthKey: z.string(),
      label: z.string(),
      amountCents: z.number().int(),
    }),
  ),
  score: z.number(),
});

export const dashboardInsightSchema = z.object({
  title: z.string(),
  detail: z.string(),
  tone: z.enum(['neutral', 'good', 'warn', 'bad']),
});

export const dashboardKpiToneSchema = z.enum(['positive', 'negative', 'default']);

export const dashboardKpiWithDeltaSchema = z.object({
  cents: z.number().int(),
  prevCents: z.number().int(),
  deltaLabel: z.string(),
  tone: dashboardKpiToneSchema,
});

export const dashboardTrendPointSchema = z.object({
  label: z.string(),
  incomeCents: z.number().int(),
  expenseCents: z.number().int(),
  balanceCents: z.number().int(),
});

export const dashboardCategoryAmountSchema = z.object({
  name: z.string(),
  amountCents: z.number().int(),
});

export const dashboardYieldingAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  balanceCents: z.number().int(),
  yieldType: yieldTypeSchema,
  yieldBps: z.number().int().nullable(),
  monthlyYieldCents: z.number().int(),
  yieldLabel: z.string(),
});

export const dashboardFinancingCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  institution: z.string().nullable(),
  amortizationSystem: z.string(),
  paidCount: z.number().int(),
  installmentCount: z.number().int(),
  remainingCents: z.number().int(),
  progressPct: z.number(),
  nextDueOn: isoDateSchema.nullable(),
  nextAmountCents: z.number().int().nullable(),
});

export const dashboardDueInstallmentSchema = z.object({
  id: z.string().uuid(),
  financingId: z.string().uuid(),
  financingName: z.string(),
  number: z.number().int(),
  dueOn: isoDateSchema,
  amountCents: z.number().int(),
  statusVariant: z.enum(['destructive', 'secondary', 'outline']),
  statusLabel: z.string(),
});

export const dashboardRecentTransactionSchema = z.object({
  id: z.string().uuid(),
  occurredOn: isoDateSchema,
  description: z.string(),
  costCenterName: z.string(),
  categoryName: z.string(),
  type: z.enum(['income', 'expense']),
  amountCents: z.number().int(),
});

/** Origem da obrigação no radar de caixa (próximos dias). */
export const dashboardObligationKindSchema = z.enum([
  'credit_card_invoice',
  'payable',
  'financing',
]);

export const dashboardCashRadarObligationSchema = z.object({
  id: z.string(),
  kind: dashboardObligationKindSchema,
  label: z.string(),
  dueOn: isoDateSchema,
  amountCents: z.number().int(),
  statusVariant: z.enum(['destructive', 'secondary', 'outline']),
  statusLabel: z.string(),
});

export const dashboardCashRadarCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastFour: z.string().nullable(),
  invoiceBalanceCents: z.number().int(),
  availableCents: z.number().int(),
  closesOn: isoDateSchema.nullable(),
  dueOn: isoDateSchema.nullable(),
  status: z.enum(['open', 'closed', 'paid', 'none']),
});

/**
 * Liquidez vs obrigações no horizonte do período selecionado
 * (“consigo pagar o que vence?”).
 * `active: false` quando o filtro é só passado — o radar não se aplica.
 */
export const dashboardCashRadarSchema = z.object({
  active: z.boolean(),
  horizonDays: z.number().int().nonnegative(),
  horizonStart: isoDateSchema,
  horizonEnd: isoDateSchema,
  /** Ex.: "28/07/2026 – 31/07/2026" quando ativo. */
  horizonLabel: z.string(),
  /** Saldos em contas que não são caixinha/investimento. */
  liquidCents: z.number().int(),
  obligationsTotalCents: z.number().int(),
  /** liquid − obrigações no horizonte (negativo = falta caixa). */
  gapCents: z.number().int(),
  overdueCents: z.number().int(),
  invoicesDueCents: z.number().int(),
  payablesDueCents: z.number().int(),
  financingDueCents: z.number().int(),
  obligations: z.array(dashboardCashRadarObligationSchema),
  cards: z.array(dashboardCashRadarCardSchema),
});

export const dashboardPaymentMixBucketSchema = z.object({
  key: z.enum(['account', 'credit_card']),
  label: z.string(),
  amountCents: z.number().int(),
  sharePct: z.number(),
});

/** Como as despesas do período saíram (conta à vista vs crédito). */
export const dashboardPaymentMixSchema = z.object({
  totalExpenseCents: z.number().int(),
  buckets: z.array(dashboardPaymentMixBucketSchema),
});

export const dashboardPlanningPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: planKindSchema,
  kindLabel: z.string(),
  targetDate: isoDateSchema,
  savedCents: z.number().int(),
  targetCents: z.number().int(),
  remainingCents: z.number().int(),
  progressPct: z.number(),
  /** Aporte mensal estimado para fechar a meta na data. */
  monthlyNeededCents: z.number().int().nullable(),
  linkedAccountName: z.string().nullable(),
  isComplete: z.boolean(),
  isOverdue: z.boolean(),
});

/**
 * Snapshot de metas — ponto no tempo (não depende do período de análise),
 * mas ajuda a decidir se o ritmo de poupança cobre os planos.
 */
export const dashboardPlanningSchema = z.object({
  totalPlannedCents: z.number().int(),
  totalSavedCents: z.number().int(),
  totalRemainingCents: z.number().int(),
  /** Soma dos aportes mensais necessários das metas abertas. */
  monthlyNeededTotalCents: z.number().int(),
  nextPlan: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      targetDate: isoDateSchema,
      kind: planKindSchema,
    })
    .nullable(),
  plans: z.array(dashboardPlanningPlanSchema),
});

export const dashboardResponseSchema = z.object({
  today: isoDateSchema,
  weekEnd: isoDateSchema,
  range: z.object({
    start: isoDateSchema,
    end: isoDateSchema,
    period: z.string(),
    label: z.string(),
  }),
  scopeLabel: z.string(),
  scopeQuery: z.object({
    center: z.string().uuid().nullable(),
    period: z.string(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  meta: z.object({
    movementCount: z.number().int(),
    financingCount: z.number().int(),
    elapsedDays: z.number().int(),
    rangeDays: z.number().int(),
  }),
  kpis: z.object({
    income: dashboardKpiWithDeltaSchema,
    expense: dashboardKpiWithDeltaSchema,
    balance: dashboardKpiWithDeltaSchema,
    savingsRate: z.object({
      value: z.number().nullable(),
      expenseShare: z.number().int().nullable(),
      hint: z.string(),
      tone: dashboardKpiToneSchema,
    }),
    avgDailySpend: z.object({
      cents: z.number().int(),
      projectedExpenseCents: z.number().int(),
      hint: z.string(),
    }),
    debtRemaining: z.object({
      cents: z.number().int(),
      pendingCount: z.number().int(),
    }),
    wealth: z.object({
      totalCents: z.number().int(),
      investedCents: z.number().int(),
      liquidCents: z.number().int(),
      monthlyYieldCents: z.number().int(),
      accountCount: z.number().int(),
    }),
  }),
  yieldingAccounts: z.array(dashboardYieldingAccountSchema),
  cashRadar: dashboardCashRadarSchema,
  paymentMix: dashboardPaymentMixSchema,
  planning: dashboardPlanningSchema,
  attentionSignals: z.array(attentionSignalSchema),
  trend: z.array(dashboardTrendPointSchema),
  byCategory: z.array(dashboardCategoryAmountSchema),
  byCenter: z.array(dashboardCategoryAmountSchema),
  insights: z.array(dashboardInsightSchema),
  financingCards: z.array(dashboardFinancingCardSchema),
  upcomingTotalCents: z.number().int(),
  dueInstallments: z.array(dashboardDueInstallmentSchema),
  recentTransactions: z.array(dashboardRecentTransactionSchema),
  lookups: z.object({
    centers: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    activeCenterId: z.string().uuid().nullable(),
    customFrom: z.string().optional(),
    customTo: z.string().optional(),
  }),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
