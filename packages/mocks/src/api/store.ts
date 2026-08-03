import type {
  AccountsResponse,
  BootstrapResponse,
  CategoriesResponse,
  CostCentersResponse,
  FinancingsResponse,
  IncomePromptResponse,
  MeResponse,
  MembersResponse,
  PaymentsResponse,
  PlanningResponse,
  PreferencesResponse,
  TransactionsResponse,
  WealthResponse,
} from '@tim/api-contract';
import { listCapabilities } from '@tim/permissions';
import { DEMO } from '../session';
import { MOCK_IDS } from './ids';

export type MockTransaction = {
  id: string;
  type: 'income' | 'expense';
  status: 'pending' | 'paid';
  amountCents: number | null;
  occurredOn: string;
  dueOn: string | null;
  paidOn: string | null;
  description: string | null;
  categoryId: string;
  categoryName: string;
  costCenterId: string;
  costCenterName: string;
  accountId: string;
  installmentId: string | null;
};

export type MockStore = {
  householdId: string;
  me: MeResponse;
  bootstrap: BootstrapResponse;
  preferences: PreferencesResponse;
  members: MembersResponse;
  categories: CategoriesResponse;
  costCenters: CostCentersResponse;
  accounts: AccountsResponse;
  wealth: WealthResponse;
  financings: FinancingsResponse;
  planning: PlanningResponse;
  incomePrompt: IncomePromptResponse;
  transactions: MockTransaction[];
  importJobs: Map<string, { fileName: string; rows: unknown[] }>;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthDay(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Dia fixo em um mês relativo (0 = atual, 1 = próximo, -1 = passado). */
function relativeMonthDay(monthOffset: number, day: number): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, day));
  return date.toISOString().slice(0, 10);
}

function yearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function tx(
  id: string,
  partial: Omit<MockTransaction, 'id' | 'categoryName' | 'costCenterName'> & {
    categoryName?: string;
    costCenterName?: string;
  },
): MockTransaction {
  const categoryNames: Record<string, string> = {
    [MOCK_IDS.categorySalario]: 'Salário',
    [MOCK_IDS.categorySupermercado]: 'Supermercado',
    [MOCK_IDS.categoryTransporte]: 'Transporte',
    [MOCK_IDS.categoryMoradia]: 'Moradia',
    [MOCK_IDS.categoryLazer]: 'Lazer',
    [MOCK_IDS.categoryOutros]: 'Outros',
  };
  const centerNames: Record<string, string> = {
    [MOCK_IDS.costCenterPf]: 'Pessoa Física',
    [MOCK_IDS.costCenterEmpresa]: 'Empresa X',
  };
  return {
    id,
    categoryName: partial.categoryName ?? categoryNames[partial.categoryId] ?? 'Outros',
    costCenterName: partial.costCenterName ?? centerNames[partial.costCenterId] ?? 'Pessoa Física',
    ...partial,
  };
}

export function createMockStore(): MockStore {
  const today = todayIso();

  const transactions: MockTransaction[] = [
    tx('00000000-0000-4000-8000-000000001001', {
      type: 'income',
      status: 'paid',
      amountCents: 850_000,
      occurredOn: monthDay(-20),
      dueOn: monthDay(-20),
      paidOn: monthDay(-20),
      description: 'Salário',
      categoryId: MOCK_IDS.categorySalario,
      costCenterId: MOCK_IDS.costCenterPf,
      accountId: MOCK_IDS.accountNubank,
      installmentId: null,
    }),
    tx('00000000-0000-4000-8000-000000001002', {
      type: 'expense',
      status: 'paid',
      amountCents: 220_000,
      occurredOn: monthDay(-8),
      dueOn: monthDay(-8),
      paidOn: monthDay(-8),
      description: 'Aluguel',
      categoryId: MOCK_IDS.categoryMoradia,
      costCenterId: MOCK_IDS.costCenterPf,
      accountId: MOCK_IDS.accountNubank,
      installmentId: null,
    }),
    tx('00000000-0000-4000-8000-000000001003', {
      type: 'expense',
      status: 'paid',
      amountCents: 4_800,
      occurredOn: monthDay(-10),
      dueOn: monthDay(-10),
      paidOn: monthDay(-10),
      description: 'Uber',
      categoryId: MOCK_IDS.categoryTransporte,
      costCenterId: MOCK_IDS.costCenterPf,
      accountId: MOCK_IDS.accountCarteira,
      installmentId: null,
    }),
    tx('00000000-0000-4000-8000-000000001004', {
      type: 'expense',
      status: 'paid',
      amountCents: 100_000,
      occurredOn: monthDay(-3),
      dueOn: monthDay(-3),
      paidOn: monthDay(-3),
      description: 'Supermercado',
      categoryId: MOCK_IDS.categorySupermercado,
      costCenterId: MOCK_IDS.costCenterPf,
      accountId: MOCK_IDS.accountNubank,
      installmentId: null,
    }),
    tx('00000000-0000-4000-8000-000000001005', {
      type: 'expense',
      status: 'pending',
      amountCents: 28_500,
      occurredOn: monthDay(5),
      dueOn: monthDay(5),
      paidOn: null,
      description: 'Energia elétrica',
      categoryId: MOCK_IDS.categoryMoradia,
      costCenterId: MOCK_IDS.costCenterPf,
      accountId: MOCK_IDS.accountNubank,
      installmentId: null,
    }),
    tx('00000000-0000-4000-8000-000000001006', {
      type: 'income',
      status: 'pending',
      amountCents: null,
      occurredOn: monthDay(2),
      dueOn: monthDay(2),
      paidOn: null,
      description: 'Salário · Contrato Empresa',
      categoryId: MOCK_IDS.categorySalario,
      costCenterId: MOCK_IDS.costCenterPf,
      accountId: MOCK_IDS.accountNubank,
      installmentId: null,
    }),
    tx('00000000-0000-4000-8000-000000001007', {
      type: 'expense',
      status: 'pending',
      amountCents: 220_000,
      occurredOn: relativeMonthDay(1, 5),
      dueOn: relativeMonthDay(1, 5),
      paidOn: null,
      description: 'Aluguel (próximo mês)',
      categoryId: MOCK_IDS.categoryMoradia,
      costCenterId: MOCK_IDS.costCenterPf,
      accountId: MOCK_IDS.accountNubank,
      installmentId: null,
    }),
    tx('00000000-0000-4000-8000-000000001008', {
      type: 'expense',
      status: 'pending',
      amountCents: 89_900,
      occurredOn: relativeMonthDay(1, 12),
      dueOn: relativeMonthDay(1, 12),
      paidOn: null,
      description: 'Internet + celular',
      categoryId: MOCK_IDS.categoryMoradia,
      costCenterId: MOCK_IDS.costCenterPf,
      accountId: MOCK_IDS.accountNubank,
      installmentId: null,
    }),
  ];

  return {
    householdId: MOCK_IDS.householdId,
    me: {
      userId: DEMO.userId,
      email: DEMO.email,
      householdId: MOCK_IDS.householdId,
      role: 'admin',
      mfaEnabled: true,
      canManageMembers: true,
      capabilities: listCapabilities('admin'),
    },
    bootstrap: {
      ttsEnabled: false,
      theme: 'system',
      incomeDay: 5,
      costCenters: [
        { id: MOCK_IDS.costCenterPf, name: 'Pessoa Física' },
        { id: MOCK_IDS.costCenterEmpresa, name: 'Empresa X' },
      ],
      accounts: [
        { id: MOCK_IDS.accountCarteira, name: 'Carteira / Dinheiro', isArchived: false },
        { id: MOCK_IDS.accountNubank, name: 'Nubank PF', isArchived: false },
        { id: MOCK_IDS.accountPj, name: 'Conta PJ Empresa X', isArchived: false },
      ],
      categories: [
        { id: MOCK_IDS.categorySalario, name: 'Salário', type: 'income' },
        { id: MOCK_IDS.categorySupermercado, name: 'Supermercado', type: 'expense' },
        { id: MOCK_IDS.categoryTransporte, name: 'Transporte', type: 'expense' },
        { id: MOCK_IDS.categoryMoradia, name: 'Moradia', type: 'expense' },
        { id: MOCK_IDS.categoryLazer, name: 'Lazer', type: 'expense' },
        { id: MOCK_IDS.categoryOutros, name: 'Outros', type: 'expense' },
      ],
    },
    preferences: {
      emailDueReminders: true,
      reminderWindowsDays: [7, 3, 1],
      weeklySummary: true,
      incomeDay: 5,
      theme: 'system',
      ttsEnabled: false,
      defaultCostCenterId: MOCK_IDS.costCenterPf,
      defaultAccountId: MOCK_IDS.accountNubank,
      lookups: {
        centers: [
          { id: MOCK_IDS.costCenterPf, name: 'Pessoa Física' },
          { id: MOCK_IDS.costCenterEmpresa, name: 'Empresa X' },
        ],
        accounts: [
          { id: MOCK_IDS.accountCarteira, name: 'Carteira / Dinheiro' },
          { id: MOCK_IDS.accountNubank, name: 'Nubank PF' },
        ],
      },
    },
    members: {
      currentUserId: DEMO.userId,
      members: [
        {
          id: MOCK_IDS.membershipSelf,
          userId: DEMO.userId,
          email: DEMO.email,
          role: 'admin',
          createdAt: new Date('2025-01-01').toISOString(),
          isSelf: true,
        },
        {
          id: MOCK_IDS.membershipSpouse,
          userId: DEMO.spouseUserId,
          email: DEMO.spouseEmail,
          role: 'admin',
          createdAt: new Date('2025-01-15').toISOString(),
          isSelf: false,
        },
      ],
      invites: [
        {
          id: MOCK_IDS.invitePending,
          email: 'convidado@demo.local',
          role: 'viewer',
          expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        },
      ],
    },
    categories: {
      items: [
        { id: MOCK_IDS.categorySalario, name: 'Salário', type: 'income', isSystem: true },
        {
          id: MOCK_IDS.categorySupermercado,
          name: 'Supermercado',
          type: 'expense',
          isSystem: true,
        },
        { id: MOCK_IDS.categoryTransporte, name: 'Transporte', type: 'expense', isSystem: true },
        { id: MOCK_IDS.categoryMoradia, name: 'Moradia', type: 'expense', isSystem: true },
        { id: MOCK_IDS.categoryLazer, name: 'Lazer', type: 'expense', isSystem: true },
        { id: MOCK_IDS.categoryOutros, name: 'Outros', type: 'expense', isSystem: true },
      ],
    },
    costCenters: {
      items: [
        {
          id: MOCK_IDS.costCenterPf,
          name: 'Pessoa Física',
          color: '#2d6a4f',
          isSystem: true,
        },
        {
          id: MOCK_IDS.costCenterEmpresa,
          name: 'Empresa X',
          color: '#3d5a80',
          isSystem: false,
        },
      ],
    },
    accounts: {
      institutions: [{ id: MOCK_IDS.institutionNubank, name: 'Nubank' }],
      bankSections: [
        {
          key: 'none',
          title: 'Sem banco',
          institutionId: null,
          editable: false,
          accounts: [
            {
              id: MOCK_IDS.accountCarteira,
              name: 'Carteira / Dinheiro',
              kind: 'cash',
              costCenterId: MOCK_IDS.costCenterPf,
              costCenterName: 'Pessoa Física',
              institutionId: null,
              parentAccountId: null,
              balanceCents: 35_000,
              yieldType: 'none',
              yieldBps: null,
              yieldLabel: 'Sem rendimento',
              allowedPaymentRails: ['pix', 'debit', 'ted', 'boleto'],
              isChild: false,
            },
          ],
          creditCards: [],
        },
        {
          key: MOCK_IDS.institutionNubank,
          title: 'Nubank',
          institutionId: MOCK_IDS.institutionNubank,
          editable: true,
          accounts: [
            {
              id: MOCK_IDS.accountNubank,
              name: 'Nubank PF',
              kind: 'checking',
              costCenterId: MOCK_IDS.costCenterPf,
              costCenterName: 'Pessoa Física',
              institutionId: MOCK_IDS.institutionNubank,
              parentAccountId: null,
              balanceCents: 2_450_00,
              yieldType: 'none',
              yieldBps: null,
              yieldLabel: 'Sem rendimento',
              allowedPaymentRails: ['pix', 'debit', 'ted', 'boleto'],
              isChild: false,
            },
            {
              id: MOCK_IDS.accountReserva,
              name: 'Caixinha Reserva',
              kind: 'investment_pot',
              costCenterId: MOCK_IDS.costCenterPf,
              costCenterName: 'Pessoa Física',
              institutionId: MOCK_IDS.institutionNubank,
              parentAccountId: MOCK_IDS.accountNubank,
              balanceCents: 8_000_00,
              yieldType: 'cdi',
              yieldBps: 10_000,
              yieldLabel: '100% CDI',
              allowedPaymentRails: [],
              isChild: true,
            },
          ],
          creditCards: [
            {
              id: MOCK_IDS.creditCard,
              name: 'Nubank Ultravioleta',
              institutionId: MOCK_IDS.institutionNubank,
              paymentAccountId: MOCK_IDS.accountNubank,
              lastFour: '4242',
              cardMode: 'both',
              creditLimitCents: 15_000_00,
              invoiceBalanceCents: 1_200_00,
              availableCents: 13_800_00,
              closingDay: 3,
              dueDay: 10,
            },
          ],
        },
      ],
      lookups: {
        centers: [
          { id: MOCK_IDS.costCenterPf, name: 'Pessoa Física' },
          { id: MOCK_IDS.costCenterEmpresa, name: 'Empresa X' },
        ],
        banks: [{ id: MOCK_IDS.institutionNubank, name: 'Nubank' }],
        parentOptions: [{ id: MOCK_IDS.accountNubank, name: 'Nubank PF' }],
        paymentAccountOptions: [{ id: MOCK_IDS.accountNubank, name: 'Nubank PF' }],
        defaultPaymentAccountId: MOCK_IDS.accountNubank,
      },
      isEmpty: false,
    },
    wealth: {
      summary: {
        assetsCents: 10_485_00,
        liabilitiesCents: 1_200_00,
        netCents: 9_285_00,
        liquidCents: 2_485_00,
        investedCents: 8_000_00,
        monthlyYieldCents: 65_00,
      },
      bankGroups: [
        {
          bankId: 'cash',
          bankName: 'Dinheiro',
          bankTotalCents: 35_000,
          accounts: [
            {
              id: MOCK_IDS.accountCarteira,
              name: 'Carteira / Dinheiro',
              kind: 'cash',
              balanceCents: 35_000,
              costCenterId: MOCK_IDS.costCenterPf,
              costCenterName: 'Pessoa Física',
              institutionId: null,
              parentAccountId: null,
              parentName: null,
              yieldType: 'none',
              yieldBps: null,
              monthlyYieldCents: 0,
              yieldLabel: 'Sem rendimento',
            },
          ],
          creditCards: [],
        },
        {
          bankId: MOCK_IDS.institutionNubank,
          bankName: 'Nubank',
          bankTotalCents: 10_450_00,
          accounts: [
            {
              id: MOCK_IDS.accountNubank,
              name: 'Nubank PF',
              kind: 'checking',
              balanceCents: 2_450_00,
              costCenterId: MOCK_IDS.costCenterPf,
              costCenterName: 'Pessoa Física',
              institutionId: MOCK_IDS.institutionNubank,
              parentAccountId: null,
              parentName: null,
              yieldType: 'none',
              yieldBps: null,
              monthlyYieldCents: 0,
              yieldLabel: 'Sem rendimento',
            },
            {
              id: MOCK_IDS.accountReserva,
              name: 'Caixinha Reserva',
              kind: 'investment_pot',
              balanceCents: 8_000_00,
              costCenterId: MOCK_IDS.costCenterPf,
              costCenterName: 'Pessoa Física',
              institutionId: MOCK_IDS.institutionNubank,
              parentAccountId: MOCK_IDS.accountNubank,
              parentName: 'Nubank PF',
              yieldType: 'cdi',
              yieldBps: 10_000,
              monthlyYieldCents: 65_00,
              yieldLabel: '100% CDI',
            },
          ],
          creditCards: [
            {
              id: MOCK_IDS.creditCard,
              name: 'Nubank Ultravioleta',
              institutionId: MOCK_IDS.institutionNubank,
              lastFour: '4242',
              cardMode: 'both',
              invoiceBalanceCents: 1_200_00,
              availableCents: 13_800_00,
              closingDay: 3,
              dueDay: 10,
              paymentAccountId: MOCK_IDS.accountNubank,
            },
          ],
        },
      ],
      transfers: [],
      transferForm: {
        accounts: [
          {
            id: MOCK_IDS.accountNubank,
            name: 'Nubank PF',
            kind: 'checking',
            balanceCents: 2_450_00,
            label: 'Nubank PF',
          },
          {
            id: MOCK_IDS.accountReserva,
            name: 'Caixinha Reserva',
            kind: 'investment_pot',
            balanceCents: 8_000_00,
            label: 'Caixinha Reserva',
          },
        ],
        defaultFromId: MOCK_IDS.accountNubank,
        defaultToId: MOCK_IDS.accountReserva,
        today,
      },
      paymentAccountOptions: [{ id: MOCK_IDS.accountNubank, name: 'Nubank PF' }],
      isEmpty: false,
    },
    financings: {
      filters: { centerId: null, activeCenterName: null },
      summary: {
        contractCount: 2,
        totalRemainingCents: 322_000_00,
        totalAmortizeCents: 3_000_00,
        totalPaidCents: 23_000_00,
        totalPendingInstallments: 214,
      },
      contracts: [
        {
          id: MOCK_IDS.financingCarro,
          name: 'Carro Demo',
          institution: 'Banco Demo',
          category: 'vehicle',
          system: 'price',
          rateLabel: '18,9% a.a.',
          installmentCount: 36,
          principalCents: 45_000_00,
          installmentAmountCents: 1_500_00,
          annualRateBps: 1890,
          firstDueOn: monthDay(5),
          pendingCount: 34,
          remainingCents: 42_000_00,
          amortizeCents: 1_500_00,
          paidCents: 3_000_00,
          progress: 0.067,
          residualBalanceCents: 42_000_00,
          amortizationPerPeriodCents: 1_500_00,
          nextPending: {
            id: MOCK_IDS.installmentNext,
            number: 3,
            dueOn: monthDay(5),
            status: 'pending',
            amountCents: 1_500_00,
            interestCents: 650_00,
            principalCents: 850_00,
            paidOn: null,
          },
          installments: [
            {
              id: '00000000-0000-4000-8000-000000000811',
              number: 1,
              dueOn: monthDay(-60),
              status: 'paid',
              amountCents: 1_500_00,
              interestCents: 700_00,
              principalCents: 800_00,
              paidOn: monthDay(-58),
            },
            {
              id: '00000000-0000-4000-8000-000000000812',
              number: 2,
              dueOn: monthDay(-30),
              status: 'paid',
              amountCents: 1_500_00,
              interestCents: 675_00,
              principalCents: 825_00,
              paidOn: monthDay(-28),
            },
            {
              id: MOCK_IDS.installmentNext,
              number: 3,
              dueOn: monthDay(5),
              status: 'pending',
              amountCents: 1_500_00,
              interestCents: 650_00,
              principalCents: 850_00,
              paidOn: null,
            },
          ],
        },
        {
          id: MOCK_IDS.financingImovel,
          name: 'Apartamento Demo',
          institution: 'Caixa',
          category: 'real_estate',
          system: 'sac',
          rateLabel: '9,6% a.a.',
          installmentCount: 240,
          principalCents: 300_000_00,
          installmentAmountCents: 2_800_00,
          annualRateBps: 960,
          firstDueOn: monthDay(10),
          pendingCount: 180,
          remainingCents: 280_000_00,
          amortizeCents: 1_500_00,
          paidCents: 20_000_00,
          progress: 0.067,
          residualBalanceCents: 280_000_00,
          amortizationPerPeriodCents: 1_500_00,
          nextPending: {
            id: MOCK_IDS.installmentImovelNext,
            number: 61,
            dueOn: monthDay(10),
            status: 'pending',
            amountCents: 2_800_00,
            interestCents: 1_300_00,
            principalCents: 1_500_00,
            paidOn: null,
          },
          installments: [
            {
              id: MOCK_IDS.installmentImovelNext,
              number: 61,
              dueOn: monthDay(10),
              status: 'pending',
              amountCents: 2_800_00,
              interestCents: 1_300_00,
              principalCents: 1_500_00,
              paidOn: null,
            },
          ],
        },
      ],
      lookups: {
        centers: [{ id: MOCK_IDS.costCenterPf, name: 'Pessoa Física' }],
        categories: [{ id: MOCK_IDS.categoryMoradia, name: 'Moradia' }],
        potAccounts: [{ id: MOCK_IDS.accountReserva, name: 'Caixinha Reserva' }],
        planCenters: [{ id: MOCK_IDS.costCenterPf, name: 'Pessoa Física' }],
        accounts: [{ id: MOCK_IDS.accountNubank, name: 'Nubank PF' }],
        defaultCostCenterId: MOCK_IDS.costCenterPf,
      },
      isEmpty: false,
    },
    planning: {
      filters: { kind: 'all' },
      summary: {
        totalPlannedCents: 10_000_00,
        totalSavedCents: 1_250_00,
        totalRemainingCents: 8_750_00,
        nextPlan: {
          id: MOCK_IDS.planViagem,
          name: 'Viagem Japão 2027',
          targetDate: '2027-06-15',
          kind: 'travel',
        },
      },
      plans: [
        {
          id: MOCK_IDS.planViagem,
          kind: 'travel',
          name: 'Viagem Japão 2027',
          targetDate: '2027-06-15',
          savedCents: 1_250_00,
          targetCents: 10_000_00,
          monthlyTargetCents: 800_00,
          linkedAccountName: 'Caixinha Reserva',
          financingName: null,
          items: [
            { label: 'Passagem', amountCents: 3_000_00 },
            { label: 'Hotel', amountCents: 5_000_00 },
            { label: 'Passeios', amountCents: 2_000_00 },
          ],
          contributions: [
            { dueOn: '2026-08-01', amountCents: 800_00 },
            { dueOn: '2026-09-01', amountCents: 800_00 },
          ],
          canWrite: true,
        },
      ],
      lookups: {
        centers: [{ id: MOCK_IDS.costCenterPf, name: 'Pessoa Física' }],
        potAccounts: [{ id: MOCK_IDS.accountReserva, name: 'Caixinha Reserva' }],
        financings: [
          {
            id: MOCK_IDS.financingCarro,
            name: 'Carro Demo',
            category: 'vehicle',
            balanceCents: 42_000_00,
            system: 'price',
            annualRateBps: 1890,
            installmentAmountCents: 1_500_00,
            amortizationCents: 850_00,
            firstDueOn: monthDay(5),
            pendingInstallments: [
              {
                number: 3,
                dueOn: monthDay(5),
                principalCents: 850_00,
                amountCents: 1_500_00,
                interestCents: 650_00,
              },
            ],
          },
          {
            id: MOCK_IDS.financingImovel,
            name: 'Apartamento Demo',
            category: 'real_estate',
            balanceCents: 280_000_00,
            system: 'sac',
            annualRateBps: 960,
            installmentAmountCents: 2_800_00,
            amortizationCents: 1_500_00,
            firstDueOn: monthDay(10),
            pendingInstallments: Array.from({ length: 12 }, (_, index) => {
              const number = 61 + index;
              const principalCents = 1_500_00 - index * 5_00;
              return {
                number,
                dueOn: relativeMonthDay(index, 10),
                principalCents,
                amountCents: principalCents + 1_300_00 - index * 10_00,
                interestCents: 1_300_00 - index * 10_00,
              };
            }),
          },
        ],
      },
      canWrite: true,
      isEmpty: false,
    },
    incomePrompt: {
      show: false,
      mode: 'none',
      incomeDay: 5,
      pendingIncomes: [],
      accounts: [{ id: MOCK_IDS.accountNubank, name: 'Nubank PF' }],
      yearMonth: yearMonth(),
    },
    transactions,
    importJobs: new Map(),
  };
}

let globalStore: MockStore | null = null;

export function getMockStore(): MockStore {
  globalStore ??= createMockStore();
  return globalStore;
}

export function resetMockStore(): MockStore {
  globalStore = createMockStore();
  return globalStore;
}
