import { API_BASE_PATH } from '@tim/api-contract';
import type {
  AccountsResponse,
  DashboardResponse,
  PaymentsResponse,
  TransactionsResponse,
} from '@tim/api-contract';
import { resolveCashRadarWindow, resolveDateRangeWithLegacyMonth } from '@tim/domain';
import { MOCK_IDS } from './ids';
import { getMockStore, type MockStore, type MockTransaction } from './store';

export class MockApiError extends Error {
  constructor(
    readonly code: 'VALIDATION' | 'NOT_FOUND' | 'INTERNAL',
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'MockApiError';
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

function resolveMockRange(searchParams: URLSearchParams) {
  return resolveDateRangeWithLegacyMonth({
    period: searchParams.get('period') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    month: searchParams.get('month') ?? undefined,
  });
}

function parsePath(input: string): { pathname: string; searchParams: URLSearchParams } {
  const url = input.startsWith('http') ? new URL(input) : new URL(input, 'http://mock.local');
  return { pathname: url.pathname, searchParams: url.searchParams };
}

function newId(): string {
  return crypto.randomUUID();
}

function utf8ToBase64(text: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(text);
  }
  return Buffer.from(text, 'utf8').toString('base64');
}

function ok(): { ok: true } {
  return { ok: true as const };
}

function buildTransactionsResponse(
  store: MockStore,
  searchParams: URLSearchParams,
): TransactionsResponse {
  const range = resolveMockRange(searchParams);
  const { start, end } = range;
  const typeFilter = searchParams.get('type') as 'income' | 'expense' | null;
  const statusFilter = searchParams.get('status') as 'pending' | 'paid' | null;
  const centerId = searchParams.get('center') || null;
  const categoryFilter = searchParams.get('category') || null;
  const searchQuery = searchParams.get('q') ?? '';
  const bankFilter = searchParams.get('bank') || null;
  const accountFilter = searchParams.get('account') || null;
  const railFilter = searchParams.get('rail') as
    'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | 'credit_card' | null;
  const cardFilter = searchParams.get('card') || null;

  const accountInstitution: Record<string, string | null> = {
    [MOCK_IDS.accountCarteira]: null,
    [MOCK_IDS.accountNubank]: MOCK_IDS.institutionNubank,
    [MOCK_IDS.accountPj]: MOCK_IDS.institutionNubank,
    [MOCK_IDS.accountReserva]: MOCK_IDS.institutionNubank,
  };

  let rows = store.transactions.filter((row) => row.occurredOn >= start && row.occurredOn <= end);
  if (typeFilter) rows = rows.filter((r) => r.type === typeFilter);
  if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
  if (centerId) rows = rows.filter((r) => r.costCenterId === centerId);
  if (categoryFilter) rows = rows.filter((r) => r.categoryId === categoryFilter);
  if (accountFilter) rows = rows.filter((r) => r.accountId === accountFilter);
  if (bankFilter) {
    rows = rows.filter((r) => accountInstitution[r.accountId] === bankFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    rows = rows.filter((r) => r.description?.toLowerCase().includes(q));
  }

  const paid = rows.filter((r) => r.status === 'paid' && r.amountCents != null);
  const incomeCents = paid
    .filter((r) => r.type === 'income')
    .reduce((s, r) => s + (r.amountCents ?? 0), 0);
  const expenseCents = paid
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + (r.amountCents ?? 0), 0);

  return {
    canEdit: true,
    range: {
      start: range.start,
      end: range.end,
      period: range.period,
      label: range.label,
    },
    scopeLabel:
      [centerId ? 'Pessoa Física' : null, bankFilter ? 'Nubank' : null]
        .filter(Boolean)
        .join(' · ') || 'Todos os centros',
    totals: {
      totalCount: rows.length,
      incomeCents,
      expenseCents,
      truncated: false,
    },
    rows: rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      amountCents: row.amountCents,
      occurredOn: row.occurredOn,
      dueOn: row.dueOn,
      paidOn: row.paidOn,
      displayDate: row.paidOn ?? row.occurredOn,
      displayDateKind: row.status === 'paid' ? 'payment' : 'due',
      description: row.description,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      costCenterId: row.costCenterId,
      costCenterName: row.costCenterName,
      accountId: row.accountId,
      installmentId: row.installmentId,
    })),
    filters: {
      centerId,
      typeFilter,
      statusFilter,
      categoryFilter,
      searchQuery,
      bankFilter,
      accountFilter,
      railFilter,
      cardFilter,
    },
    lookups: {
      centers: store.bootstrap.costCenters.map((c) => ({ id: c.id, name: c.name })),
      categories: store.bootstrap.categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      })),
      banks: [{ id: MOCK_IDS.institutionNubank, name: 'Nubank' }],
      accounts: store.bootstrap.accounts.map((a) => {
        const detail = store.accounts.bankSections
          .flatMap((section) => section.accounts)
          .find((account) => account.id === a.id);
        return {
          id: a.id,
          name: a.name,
          institutionId: accountInstitution[a.id] ?? null,
          allowedPaymentRails: detail?.allowedPaymentRails ?? ['pix', 'debit', 'ted', 'boleto'],
        };
      }),
      creditCards: [
        {
          id: MOCK_IDS.creditCard,
          name: 'Nubank Ultravioleta',
          paymentAccountId: MOCK_IDS.accountNubank,
          institutionId: MOCK_IDS.institutionNubank,
          lastFour: '4242',
        },
      ],
      defaultCostCenterId: MOCK_IDS.costCenterPf,
      defaultOccurredOn: todayIso(),
    },
  };
}

function buildPaymentsResponse(store: MockStore, searchParams: URLSearchParams): PaymentsResponse {
  const flow = (searchParams.get('flow') as 'pay' | 'receive' | null) ?? 'pay';
  const range = resolveMockRange(searchParams);
  const { start, end } = range;
  const today = todayIso();
  const centerId = searchParams.get('center') || null;
  const kindFilter = searchParams.get('kind') as
    'fixed' | 'variable' | 'installment' | 'credit_card_invoice' | null;
  const creditCardId = searchParams.get('card') || null;

  const pending = store.transactions.filter((row) => {
    const due = row.dueOn ?? row.occurredOn;
    return (
      row.status === 'pending' &&
      due >= start &&
      due <= end &&
      row.type === (flow === 'receive' ? 'income' : 'expense') &&
      (!centerId || row.costCenterId === centerId) &&
      (!kindFilter || kindFilter === 'variable')
    );
  });

  type MockPaymentRow = {
    id: string;
    dueOn: string;
    description: string | null;
    kind: 'fixed' | 'variable' | 'installment' | 'credit_card_invoice';
    costCenterId: string | null;
    costCenterName: string;
    categoryId: string | null;
    categoryName: string;
    accountId: string;
    amountCents: number | null;
    paymentRail: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null;
    suggestedCents: number | null;
    estimatedCents: number;
    creditCardId: string | null;
    creditCardInvoiceId: string | null;
    creditCardName: string | null;
    purchaseCount: number | null;
    purchases: Array<{
      id: string;
      description: string | null;
      kind: 'fixed' | 'variable' | 'installment';
      costCenterId: string | null;
      costCenterName: string;
      categoryId: string | null;
      categoryName: string;
      accountId: string;
      paymentRail: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null;
      creditCardId: string | null;
      creditCardInvoiceId: string | null;
      occurredOn: string | null;
      amountCents: number;
    }>;
  };

  const rows: MockPaymentRow[] = pending.map((row) => ({
    id: row.id,
    dueOn: row.dueOn ?? row.occurredOn,
    description: row.description,
    kind: 'variable' as const,
    costCenterId: row.costCenterId,
    costCenterName: row.costCenterName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    accountId: row.accountId,
    amountCents: row.amountCents,
    paymentRail: 'pix',
    suggestedCents: row.amountCents,
    estimatedCents: row.amountCents ?? 0,
    creditCardId: null,
    creditCardInvoiceId: null,
    creditCardName: null,
    purchaseCount: null,
    purchases: [],
  }));

  const mockCard = {
    id: MOCK_IDS.creditCard,
    name: 'Nubank Ultravioleta',
    lastFour: '4242' as string | null,
    invoiceBalanceCents: 1_200_00,
    paymentAccountId: MOCK_IDS.accountNubank,
    dueDay: 10,
  };

  if (
    flow === 'pay' &&
    mockCard.invoiceBalanceCents > 0 &&
    (!kindFilter || kindFilter === 'credit_card_invoice') &&
    (!creditCardId || creditCardId === mockCard.id)
  ) {
    rows.unshift({
      id: mockCard.id,
      dueOn: `${today.slice(0, 8)}10`,
      description: `Fatura · ${mockCard.name} ·••• ${mockCard.lastFour}`,
      kind: 'credit_card_invoice',
      costCenterId: MOCK_IDS.costCenterPf,
      costCenterName: 'PF',
      categoryId: null,
      categoryName: 'Fatura de cartão',
      accountId: mockCard.paymentAccountId,
      amountCents: mockCard.invoiceBalanceCents,
      paymentRail: null,
      suggestedCents: mockCard.invoiceBalanceCents,
      estimatedCents: mockCard.invoiceBalanceCents,
      creditCardId: mockCard.id,
      creditCardInvoiceId: null,
      creditCardName: mockCard.name,
      purchaseCount: 2,
      purchases: [
        {
          id: '00000000-0000-4000-8000-0000000000b1',
          description: 'Mercado',
          kind: 'variable',
          costCenterId: MOCK_IDS.costCenterPf,
          costCenterName: 'PF',
          categoryId: MOCK_IDS.categorySupermercado,
          categoryName: 'Supermercado',
          accountId: mockCard.paymentAccountId,
          paymentRail: null,
          creditCardId: mockCard.id,
          creditCardInvoiceId: mockCard.id,
          occurredOn: today,
          amountCents: 800_00,
        },
        {
          id: '00000000-0000-4000-8000-0000000000b2',
          description: 'Streaming',
          kind: 'variable',
          costCenterId: MOCK_IDS.costCenterPf,
          costCenterName: 'PF',
          categoryId: MOCK_IDS.categoryLazer,
          categoryName: 'Lazer',
          accountId: mockCard.paymentAccountId,
          paymentRail: null,
          creditCardId: mockCard.id,
          creditCardInvoiceId: mockCard.id,
          occurredOn: today,
          amountCents: 400_00,
        },
      ],
    });
  }

  const settled = store.transactions.filter((row) => {
    const paidOn = row.paidOn ?? row.occurredOn;
    return (
      row.status === 'paid' &&
      paidOn >= start &&
      paidOn <= end &&
      row.type === (flow === 'receive' ? 'income' : 'expense') &&
      row.amountCents != null &&
      (!centerId || row.costCenterId === centerId) &&
      (!kindFilter || kindFilter === 'variable')
    );
  });

  const accountNameById = new Map(store.bootstrap.accounts.map((a) => [a.id, a.name]));
  const settledRows = settled.map((row) => ({
    id: row.id,
    dueOn: row.dueOn,
    paidOn: row.paidOn ?? row.occurredOn,
    description: row.description,
    kind: 'variable' as const,
    costCenterId: row.costCenterId,
    costCenterName: row.costCenterName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    accountId: row.accountId,
    accountName: accountNameById.get(row.accountId) ?? 'Conta',
    paymentRail: 'pix' as const,
    paymentMethodId: null,
    paymentMethodLabel: `PIX · ${accountNameById.get(row.accountId) ?? 'Conta'}`,
    amountCents: row.amountCents ?? 0,
  }));

  const knownPendingCents = rows.reduce((s, r) => s + (r.amountCents ?? 0), 0);
  const paidTotalCents = settledRows.reduce((s, r) => s + r.amountCents, 0);

  const tableAccounts = store.bootstrap.accounts.map((a) => ({ id: a.id, name: a.name }));
  const accountBalanceById = new Map<string, number>();
  for (const section of store.accounts.bankSections) {
    for (const account of section.accounts) {
      accountBalanceById.set(account.id, account.balanceCents);
    }
  }

  return {
    flow,
    fromPayday: false,
    today,
    range: {
      start: range.start,
      end: range.end,
      period: range.period,
      label: range.label,
    },
    filters: { centerId, kindFilter, creditCardId },
    totals: {
      paidTotalCents,
      knownPendingCents,
      estimatedGapCents: 0,
      remainingCents: knownPendingCents,
    },
    cardInvoice: null,
    rows,
    settledRows,
    lookups: {
      centers: store.bootstrap.costCenters.map((c) => ({ id: c.id, name: c.name })),
      expenseCategories: store.bootstrap.categories
        .filter((c) => c.type === 'expense')
        .map((c) => ({ id: c.id, name: c.name })),
      incomeCategories: store.bootstrap.categories
        .filter((c) => c.type === 'income')
        .map((c) => ({ id: c.id, name: c.name })),
      sheetAccounts: tableAccounts,
      tableAccounts,
      creditCards: [
        {
          id: mockCard.id,
          name: mockCard.name,
          lastFour: mockCard.lastFour,
          paymentAccountId: mockCard.paymentAccountId,
        },
      ],
      paymentMethods: [
        ...store.accounts.bankSections.flatMap((section) =>
          section.accounts.flatMap((account) =>
            account.allowedPaymentRails.map((rail, index) => ({
              id: `00000000-0000-4000-8000-${`${account.id.replace(/-/g, '')}${index}`.padEnd(12, '0').slice(0, 12)}`,
              type: 'account' as const,
              accountId: account.id,
              creditCardId: null,
              paymentRail: rail,
              linkedAccountName: account.name,
              linkedInstitutionName: section.title === 'Sem banco' ? null : section.title,
              balanceCents: accountBalanceById.get(account.id) ?? 0,
              label: `${rail === 'pix' ? 'PIX' : rail === 'debit' ? 'Débito' : rail === 'ted' ? 'TED' : 'Boleto'} · ${account.name}${section.title === 'Sem banco' ? '' : ` · ${section.title}`}`,
            })),
          ),
        ),
        {
          id: `00000000-0000-4000-8000-${mockCard.id.replace(/-/g, '').padEnd(12, '0').slice(0, 12)}`,
          type: 'credit_card' as const,
          accountId: mockCard.paymentAccountId,
          creditCardId: mockCard.id,
          paymentRail: null,
          linkedAccountName: 'Nubank PF',
          linkedInstitutionName: 'Nubank',
          balanceCents: 8_800_00,
          label: `Crédito · ${mockCard.name} ·••• ${mockCard.lastFour} · Nubank`,
        },
      ],
      defaultCostCenterId: MOCK_IDS.costCenterPf,
    },
  };
}

function buildDashboardResponse(
  store: MockStore,
  searchParams: URLSearchParams,
): DashboardResponse {
  const range = resolveMockRange(searchParams);
  const { start, end } = range;
  const today = todayIso();
  const centerId = searchParams.get('center') || null;
  const paid = store.transactions.filter(
    (r) =>
      r.status === 'paid' &&
      r.amountCents != null &&
      r.occurredOn >= start &&
      r.occurredOn <= end &&
      (!centerId || r.costCenterId === centerId),
  );
  const incomeCents = paid
    .filter((r) => r.type === 'income')
    .reduce((s, r) => s + (r.amountCents ?? 0), 0);
  const expenseCents = paid
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + (r.amountCents ?? 0), 0);
  const balanceCents = incomeCents - expenseCents;

  const recent = [...store.transactions]
    .filter((r) => r.status === 'paid' && r.amountCents != null)
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
    .slice(0, 5);

  return {
    today,
    weekEnd: addDays(today, 7),
    range: {
      start: range.start,
      end: range.end,
      period: range.period,
      label: range.label,
    },
    scopeLabel: centerId ? 'Pessoa Física' : 'Todos os centros',
    scopeQuery: {
      center: centerId,
      period: range.period,
      from: range.period === 'custom' ? range.start : undefined,
      to: range.period === 'custom' ? range.end : undefined,
    },
    meta: {
      movementCount: paid.length,
      financingCount: store.financings.contracts.length,
      elapsedDays: 15,
      rangeDays: 30,
    },
    kpis: {
      income: {
        cents: incomeCents,
        prevCents: Math.round(incomeCents * 0.95),
        deltaLabel: '+5,0% vs período anterior',
        tone: 'positive',
      },
      expense: {
        cents: expenseCents,
        prevCents: Math.round(expenseCents * 1.02),
        deltaLabel: '-2,0% vs período anterior',
        tone: 'positive',
      },
      balance: {
        cents: balanceCents,
        prevCents: balanceCents - 50_000,
        deltaLabel: 'vs período anterior',
        tone: balanceCents >= 0 ? 'positive' : 'negative',
      },
      savingsRate: {
        value: incomeCents > 0 ? balanceCents / incomeCents : null,
        expenseShare: incomeCents > 0 ? Math.round((expenseCents / incomeCents) * 100) : null,
        hint: 'Receita − despesas no período',
        tone: 'default',
      },
      avgDailySpend: {
        cents: Math.round(expenseCents / 15),
        projectedExpenseCents: Math.round((expenseCents / 15) * 30),
        hint: 'Média diária de despesas pagas',
      },
      debtRemaining: {
        cents: store.financings.summary.totalRemainingCents,
        pendingCount: store.financings.summary.totalPendingInstallments,
      },
      wealth: {
        totalCents: store.wealth.summary.netCents,
        investedCents: store.wealth.summary.investedCents,
        liquidCents: store.wealth.summary.liquidCents,
        monthlyYieldCents: store.wealth.summary.monthlyYieldCents,
        accountCount: 3,
      },
    },
    yieldingAccounts: [
      {
        id: MOCK_IDS.accountReserva,
        name: 'Caixinha Reserva',
        balanceCents: 8_000_00,
        yieldType: 'cdi',
        yieldBps: 10_000,
        monthlyYieldCents: 65_00,
        yieldLabel: '100% CDI',
      },
    ],
    cashRadar: (() => {
      const window = resolveCashRadarWindow({
        today,
        rangeStart: range.start,
        rangeEnd: range.end,
      });
      if (!window.active) {
        return {
          active: false,
          horizonDays: 0,
          horizonStart: window.horizonStart,
          horizonEnd: window.horizonEnd,
          horizonLabel: '',
          liquidCents: store.wealth.summary.liquidCents,
          obligationsTotalCents: 0,
          gapCents: 0,
          overdueCents: 0,
          invoicesDueCents: 0,
          payablesDueCents: 0,
          financingDueCents: 0,
          obligations: [],
          cards: [],
        };
      }
      const obligationsTotalCents = 1_200_00 + 28_500;
      return {
        active: true,
        horizonDays: window.horizonDays,
        horizonStart: window.horizonStart,
        horizonEnd: window.horizonEnd,
        horizonLabel: window.horizonLabel,
        liquidCents: store.wealth.summary.liquidCents,
        obligationsTotalCents,
        gapCents: store.wealth.summary.liquidCents - obligationsTotalCents,
        overdueCents: 0,
        invoicesDueCents: 1_200_00,
        payablesDueCents: 0,
        financingDueCents: 28_500,
        obligations: [
          {
            id: MOCK_IDS.creditCard,
            kind: 'credit_card_invoice' as const,
            label: 'Fatura · Nubank Ultravioleta ·••• 4242',
            dueOn: addDays(today, 5),
            amountCents: 1_200_00,
            statusVariant: 'secondary' as const,
            statusLabel: 'esta semana',
          },
          ...store.financings.contracts.flatMap((c) =>
            c.nextPending
              ? [
                  {
                    id: c.nextPending.id,
                    kind: 'financing' as const,
                    label: `${c.name} #${c.nextPending.number}`,
                    dueOn: c.nextPending.dueOn,
                    amountCents: c.nextPending.amountCents,
                    statusVariant: 'secondary' as const,
                    statusLabel: 'esta semana',
                  },
                ]
              : [],
          ),
        ],
        cards: [
          {
            id: MOCK_IDS.creditCard,
            name: 'Nubank Ultravioleta',
            lastFour: '4242',
            invoiceBalanceCents: 1_200_00,
            availableCents: 13_800_00,
            closesOn: addDays(today, -2),
            dueOn: addDays(today, 5),
            status: 'closed' as const,
          },
        ],
      };
    })(),
    paymentMix: {
      totalExpenseCents: expenseCents,
      buckets:
        expenseCents > 0
          ? [
              {
                key: 'account',
                label: 'Conta (PIX / débito / TED)',
                amountCents: Math.round(expenseCents * 0.62),
                sharePct: 62,
              },
              {
                key: 'credit_card',
                label: 'Cartão de crédito',
                amountCents: expenseCents - Math.round(expenseCents * 0.62),
                sharePct: 38,
              },
            ]
          : [],
    },
    planning: {
      totalPlannedCents: store.planning.summary.totalPlannedCents,
      totalSavedCents: store.planning.summary.totalSavedCents,
      totalRemainingCents: store.planning.summary.totalRemainingCents,
      monthlyNeededTotalCents: 800_00,
      nextPlan: store.planning.summary.nextPlan,
      plans: store.planning.plans.map((plan) => {
        const progressPct =
          plan.targetCents === 0
            ? 0
            : Math.min(100, Math.round((plan.savedCents / plan.targetCents) * 100));
        const remainingCents = Math.max(0, plan.targetCents - plan.savedCents);
        return {
          id: plan.id,
          name: plan.name,
          kind: plan.kind,
          kindLabel:
            plan.kind === 'travel'
              ? 'Viagem'
              : plan.kind === 'financing_payoff'
                ? 'Quitação'
                : plan.kind === 'real_estate_amortization'
                  ? 'Amortização'
                  : 'Personalizado',
          targetDate: plan.targetDate,
          savedCents: plan.savedCents,
          targetCents: plan.targetCents,
          remainingCents,
          progressPct,
          monthlyNeededCents: plan.monthlyTargetCents,
          linkedAccountName: plan.linkedAccountName,
          isComplete: remainingCents <= 0,
          isOverdue: remainingCents > 0 && plan.targetDate < today,
        };
      }),
    },
    attentionSignals: [],
    trend: [
      { label: 'Jan', incomeCents: 850_000, expenseCents: 320_000, balanceCents: 530_000 },
      { label: 'Fev', incomeCents: 850_000, expenseCents: 290_000, balanceCents: 560_000 },
      {
        label: 'Mar',
        incomeCents: incomeCents,
        expenseCents: expenseCents,
        balanceCents: balanceCents,
      },
    ],
    byCategory: [
      { name: 'Moradia', amountCents: 220_000 },
      { name: 'Supermercado', amountCents: 100_000 },
      { name: 'Transporte', amountCents: 4_800 },
    ],
    byCenter: [
      { name: 'Pessoa Física', amountCents: expenseCents },
      { name: 'Empresa X', amountCents: 0 },
    ],
    insights: [
      {
        title: 'Modo mock',
        detail: 'Dados em memória — sem API nem banco.',
        tone: 'neutral',
      },
    ],
    financingCards: store.financings.contracts.map((c) => ({
      id: c.id,
      name: c.name,
      institution: c.institution,
      amortizationSystem: c.system,
      paidCount: c.installmentCount - c.pendingCount,
      installmentCount: c.installmentCount,
      remainingCents: c.remainingCents,
      progressPct: c.progress,
      nextDueOn: c.nextPending?.dueOn ?? null,
      nextAmountCents: c.nextPending?.amountCents ?? null,
    })),
    upcomingTotalCents: 28_500,
    dueInstallments: store.financings.contracts.flatMap((c) =>
      c.nextPending
        ? [
            {
              id: c.nextPending.id,
              financingId: c.id,
              financingName: c.name,
              number: c.nextPending.number,
              dueOn: c.nextPending.dueOn,
              amountCents: c.nextPending.amountCents,
              statusVariant: 'secondary' as const,
              statusLabel: 'Próxima',
            },
          ]
        : [],
    ),
    recentTransactions: recent.map((r) => ({
      id: r.id,
      occurredOn: r.occurredOn,
      description: r.description ?? '',
      costCenterName: r.costCenterName,
      categoryName: r.categoryName,
      type: r.type,
      amountCents: r.amountCents ?? 0,
    })),
    lookups: {
      centers: store.bootstrap.costCenters.map((c) => ({ id: c.id, name: c.name })),
      activeCenterId: null,
    },
  };
}

function categoryName(store: MockStore, categoryId: string): string {
  return store.categories.items.find((c) => c.id === categoryId)?.name ?? 'Outros';
}

function centerName(store: MockStore, costCenterId: string): string {
  return store.costCenters.items.find((c) => c.id === costCenterId)?.name ?? 'Pessoa Física';
}

function addTransaction(
  store: MockStore,
  input: {
    type: 'income' | 'expense';
    status: 'pending' | 'paid';
    amountCents: number;
    occurredOn: string;
    description?: string | null;
    categoryId: string;
    costCenterId: string;
    accountId: string;
  },
): MockTransaction {
  const row = {
    id: newId(),
    type: input.type,
    status: input.status,
    amountCents: input.amountCents,
    occurredOn: input.occurredOn,
    dueOn: input.occurredOn,
    paidOn: input.status === 'paid' ? input.occurredOn : null,
    description: input.description ?? null,
    categoryId: input.categoryId,
    categoryName: categoryName(store, input.categoryId),
    costCenterId: input.costCenterId,
    costCenterName: centerName(store, input.costCenterId),
    accountId: input.accountId,
    installmentId: null,
  };
  store.transactions.push(row);
  return row;
}

export type MockApiRequestOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
};

export async function handleMockApiRequest<T>(
  path: string,
  options: MockApiRequestOptions = {},
): Promise<T> {
  const store = getMockStore();
  const method = (options.method ?? 'GET').toUpperCase();
  const { pathname, searchParams } = parsePath(path);
  const body = options.body;

  if (method === 'GET' && pathname === `${API_BASE_PATH}/me`) return store.me as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/bootstrap`) return store.bootstrap as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/preferences`)
    return store.preferences as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/members`) return store.members as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/categories`) return store.categories as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/cost-centers`)
    return store.costCenters as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/accounts`) return store.accounts as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/wealth`) return store.wealth as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/financings`) return store.financings as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/planning`) return store.planning as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/income-prompt`)
    return store.incomePrompt as T;
  if (method === 'GET' && pathname === `${API_BASE_PATH}/imex/template`) {
    return { csv: 'data,valor,tipo,descricao,categoria,centro,conta\n' } as T;
  }
  if (method === 'GET' && pathname === `${API_BASE_PATH}/transactions`) {
    return buildTransactionsResponse(store, searchParams) as T;
  }
  if (method === 'GET' && pathname === `${API_BASE_PATH}/payments`) {
    return buildPaymentsResponse(store, searchParams) as T;
  }
  if (method === 'GET' && pathname === `${API_BASE_PATH}/dashboard`) {
    return buildDashboardResponse(store, searchParams) as T;
  }

  if (method === 'POST' && pathname === `${API_BASE_PATH}/payments/ensure-instances`) {
    return { ok: true, yearMonth: searchParams.get('yearMonth') ?? '' } as T;
  }

  if (
    method === 'POST' &&
    pathname === `${API_BASE_PATH}/transactions` &&
    body &&
    typeof body === 'object'
  ) {
    const input = body as Record<string, unknown>;
    addTransaction(store, {
      type: input.type as 'income' | 'expense',
      status: (input.status as 'pending' | 'paid') ?? 'paid',
      amountCents: Number(input.amountCents),
      occurredOn: String(input.occurredOn),
      description: input.description != null ? String(input.description) : null,
      categoryId: String(input.categoryId),
      costCenterId: String(input.costCenterId),
      accountId: String(input.accountId),
    });
    return ok() as T;
  }

  if (method === 'PATCH' && pathname.startsWith(`${API_BASE_PATH}/transactions/`)) {
    const id = pathname.split('/').pop();
    const row = store.transactions.find((t) => t.id === id);
    if (!row) throw new MockApiError('NOT_FOUND', 'Lançamento não encontrado', 404);
    if (body && typeof body === 'object') {
      const patch = body as Record<string, unknown>;
      if (patch.description !== undefined) row.description = String(patch.description);
      if (patch.amountCents !== undefined) row.amountCents = Number(patch.amountCents);
      if (patch.occurredOn !== undefined) row.occurredOn = String(patch.occurredOn);
    }
    return ok() as T;
  }

  if (method === 'DELETE' && pathname.startsWith(`${API_BASE_PATH}/transactions/`)) {
    const id = pathname.split('/').pop();
    store.transactions = store.transactions.filter((t) => t.id !== id);
    return ok() as T;
  }

  if (method === 'POST' && pathname.endsWith('/pay') && pathname.includes('/transactions/')) {
    const parts = pathname.split('/');
    const id = parts[parts.length - 2];
    const row = store.transactions.find((t) => t.id === id);
    if (row) {
      row.status = 'paid';
      row.paidOn = todayIso();
      if (
        body &&
        typeof body === 'object' &&
        (body as { amountCents?: number }).amountCents != null
      ) {
        row.amountCents = Number((body as { amountCents: number }).amountCents);
      }
    }
    return ok() as T;
  }

  if (method === 'POST' && pathname === `${API_BASE_PATH}/institutions/setup`) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const catalogId = String(payload.catalogId ?? 'custom');
    const customName = typeof payload.customName === 'string' ? payload.customName.trim() : '';
    const bankName =
      catalogId === 'custom'
        ? customName || 'Banco'
        : catalogId === 'nubank'
          ? 'Nubank'
          : catalogId === 'itau'
            ? 'Itaú'
            : catalogId === 'inter'
              ? 'Inter'
              : catalogId.charAt(0).toUpperCase() + catalogId.slice(1);
    const institutionId = newId();
    const accountId = newId();
    const costCenterId = String(payload.costCenterId ?? MOCK_IDS.costCenterPf);
    const centerName =
      store.bootstrap.costCenters.find((c) => c.id === costCenterId)?.name ?? 'Pessoa Física';
    const accountName = String(payload.accountName ?? 'Conta corrente');
    const balanceCents = Number(payload.balanceCents ?? 0);
    const includeCard = Boolean(payload.includeCreditCard);
    const includeSavings = Boolean(payload.includeSavings);

    store.accounts.institutions.push({ id: institutionId, name: bankName });
    store.accounts.lookups.banks.push({ id: institutionId, name: bankName });
    store.bootstrap.accounts.push({
      id: accountId,
      name: `${bankName} · ${accountName}`,
      isArchived: false,
    });
    store.accounts.lookups.paymentAccountOptions.push({ id: accountId, name: accountName });
    store.accounts.lookups.parentOptions.push({ id: accountId, name: accountName });
    store.accounts.isEmpty = false;

    const savingsAccounts: AccountsResponse['bankSections'][number]['accounts'] = [];
    if (includeSavings) {
      const savingsId = newId();
      const savingsName = String(payload.savingsName ?? `Poupança ${bankName}`);
      const savingsBalanceCents = Number(payload.savingsBalanceCents ?? 0);
      savingsAccounts.push({
        id: savingsId,
        name: savingsName,
        kind: 'savings',
        costCenterId,
        costCenterName: centerName,
        institutionId,
        parentAccountId: null,
        balanceCents: savingsBalanceCents,
        yieldType: 'none',
        yieldBps: null,
        yieldLabel: 'Sem rendimento',
        allowedPaymentRails: ['pix', 'debit', 'ted', 'boleto'],
        isChild: false,
      });
      store.bootstrap.accounts.push({
        id: savingsId,
        name: `${bankName} · ${savingsName}`,
        isArchived: false,
      });
      store.accounts.lookups.paymentAccountOptions.push({ id: savingsId, name: savingsName });
      store.accounts.lookups.parentOptions.push({ id: savingsId, name: savingsName });
    }

    const cardModeRaw = String(payload.cardMode ?? 'both');
    const cardMode: 'credit' | 'debit' | 'both' =
      cardModeRaw === 'credit' || cardModeRaw === 'debit' || cardModeRaw === 'both'
        ? cardModeRaw
        : 'both';
    const hasCredit = cardMode === 'credit' || cardMode === 'both';
    const creditCards = includeCard
      ? [
          {
            id: newId(),
            name: String(payload.cardName ?? `Cartão ${bankName}`),
            institutionId,
            paymentAccountId: accountId,
            lastFour:
              typeof payload.cardLastFour === 'string' && /^\d{4}$/.test(payload.cardLastFour)
                ? payload.cardLastFour
                : null,
            cardMode,
            creditLimitCents: hasCredit ? Number(payload.creditLimitCents ?? 0) : 0,
            invoiceBalanceCents: hasCredit ? Number(payload.invoiceBalanceCents ?? 0) : 0,
            availableCents: hasCredit
              ? Math.max(
                  0,
                  Number(payload.creditLimitCents ?? 0) - Number(payload.invoiceBalanceCents ?? 0),
                )
              : 0,
            closingDay: hasCredit ? Number(payload.closingDay ?? 1) : 1,
            dueDay: hasCredit ? Number(payload.dueDay ?? 10) : 1,
          },
        ]
      : [];

    store.accounts.bankSections.push({
      key: institutionId,
      title: bankName,
      institutionId,
      editable: true,
      accounts: [
        {
          id: accountId,
          name: accountName,
          kind: 'checking',
          costCenterId,
          costCenterName: centerName,
          institutionId,
          parentAccountId: null,
          balanceCents,
          yieldType: 'none',
          yieldBps: null,
          yieldLabel: 'Sem rendimento',
          allowedPaymentRails: ['pix', 'debit', 'ted', 'boleto'],
          isChild: false,
        },
        ...savingsAccounts,
      ],
      creditCards,
    });

    return ok() as T;
  }

  if (method === 'PATCH' && pathname === `${API_BASE_PATH}/preferences`) {
    if (body && typeof body === 'object') {
      Object.assign(store.preferences, body);
      store.bootstrap.theme = store.preferences.theme;
      store.bootstrap.ttsEnabled = store.preferences.ttsEnabled;
      store.bootstrap.incomeDay = store.preferences.incomeDay;
    }
    return ok() as T;
  }

  if (method === 'PATCH' && pathname === `${API_BASE_PATH}/preferences/theme`) {
    if (body && typeof body === 'object' && 'theme' in body) {
      store.preferences.theme = (body as { theme: typeof store.preferences.theme }).theme;
      store.bootstrap.theme = store.preferences.theme;
    }
    return ok() as T;
  }

  if (method === 'POST' && pathname === `${API_BASE_PATH}/households`) {
    return { ok: true, householdId: store.householdId } as T;
  }

  if (method === 'POST' && pathname === `${API_BASE_PATH}/members/invites`) {
    return {
      inviteUrl: 'http://localhost:3000/invite/mock-token',
      emailSent: false,
    } as T;
  }

  if (method === 'POST' && pathname === `${API_BASE_PATH}/jarvis/messages`) {
    const content =
      body && typeof body === 'object' && 'content' in body
        ? String((body as { content: string }).content)
        : '';
    return {
      reply: `Modo mock: entendi "${content.slice(0, 80)}". Lance manualmente ou use import.`,
      threadId: newId(),
      intent: { type: 'unknown' },
    } as T;
  }

  if (method === 'POST' && pathname === `${API_BASE_PATH}/imex/export`) {
    return {
      base64: utf8ToBase64('data,valor\n2026-01-01,1000'),
      filename: 'lancamentos.csv',
      format: 'csv',
    } as T;
  }

  if (method === 'POST' && pathname === `${API_BASE_PATH}/imex/import/preview`) {
    const jobId = newId();
    store.importJobs.set(jobId, { fileName: 'mock.csv', rows: [] });
    return {
      jobId,
      importFormat: 'flat',
      year: null,
      fileName: 'mock.csv',
      ok: 1,
      error: 0,
      skip: 0,
      rows: [],
      paymentMethods: [],
      options: {
        categories: store.categories.items.map((c) => ({ id: c.id, name: c.name, type: c.type })),
        accounts: store.bootstrap.accounts.map((a) => ({ id: a.id, name: a.name })),
        costCenters: store.bootstrap.costCenters.map((c) => ({ id: c.id, name: c.name })),
      },
    } as T;
  }

  if (method === 'POST' && pathname.includes('/imex/import/') && pathname.endsWith('/commit')) {
    return { created: 0, skipped: 0, errors: 0 } as T;
  }

  if (
    method === 'POST' &&
    (pathname === `${API_BASE_PATH}/invites/accept` ||
      pathname === `${API_BASE_PATH}/invites/accept-by-id`)
  ) {
    return { ok: true, redirectTo: '/dashboard' } as T;
  }

  if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    return ok() as T;
  }

  throw new MockApiError('NOT_FOUND', `Mock não implementado: ${method} ${pathname}`, 404);
}
