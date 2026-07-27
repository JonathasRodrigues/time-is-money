export type TransactionType = 'income' | 'expense';

export interface NamedEntity {
  id: string;
  name: string;
}

export interface CategoryEntity extends NamedEntity {
  type: TransactionType;
  aliases: string[];
}

export interface ResolveContext {
  costCenters: NamedEntity[];
  categories: CategoryEntity[];
  accounts: Array<NamedEntity & { costCenterId: string }>;
}

export interface ResolveResult {
  costCenterId: string | null;
  categoryId: string | null;
  accountId: string | null;
  ambiguities: Array<{
    field: 'costCenter' | 'category' | 'account';
    options: NamedEntity[];
  }>;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function scoreMatch(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q) || q.includes(c)) return 80;
  return 0;
}

function pickBest(
  query: string | undefined,
  entities: NamedEntity[],
  extraNames?: (entity: NamedEntity) => string[],
): { id: string | null; options: NamedEntity[] } {
  if (!query) {
    return { id: null, options: [] };
  }

  const scored = entities
    .map((entity) => {
      const names = [entity.name, ...(extraNames?.(entity) ?? [])];
      const best = Math.max(...names.map((name) => scoreMatch(query, name)));
      return { entity, best };
    })
    .filter((row) => row.best >= 80)
    .sort((a, b) => b.best - a.best);

  if (scored.length === 0) {
    return { id: null, options: [] };
  }

  const top = scored[0];
  if (!top) {
    return { id: null, options: [] };
  }

  const ties = scored.filter((row) => row.best === top.best);
  if (ties.length > 1) {
    return { id: null, options: ties.map((row) => row.entity) };
  }

  return { id: top.entity.id, options: [] };
}

export function resolveEntities(
  input: {
    costCenter?: string;
    category?: string;
    account?: string;
  },
  context: ResolveContext,
): ResolveResult {
  const costCenter = pickBest(input.costCenter, context.costCenters);
  const category = pickBest(input.category, context.categories, (entity) => {
    const cat = entity as CategoryEntity;
    return cat.aliases ?? [];
  });
  const account = pickBest(input.account, context.accounts);

  const ambiguities: ResolveResult['ambiguities'] = [];
  if (costCenter.options.length > 1) {
    ambiguities.push({ field: 'costCenter', options: costCenter.options });
  }
  if (category.options.length > 1) {
    ambiguities.push({ field: 'category', options: category.options });
  }
  if (account.options.length > 1) {
    ambiguities.push({ field: 'account', options: account.options });
  }

  return {
    costCenterId: costCenter.id,
    categoryId: category.id,
    accountId: account.id,
    ambiguities,
  };
}

export function formatBrlFromCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Valor monetário para input (sem R$), com vírgula decimal.
 * Ex.: 123456 → `"1234,56"`.
 */
export function formatCentsForBrInput(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole},${fraction}`;
}

/**
 * Interpreta valor digitado no padrão BR (`1.234,56` ou `1234,56`)
 * ou US (`1234.56`). Retorna centavos ou `null` se inválido.
 */
export function parseBrlToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const negative = trimmed.startsWith('-');
  const body = negative ? trimmed.slice(1).trim() : trimmed;
  if (!body) return null;

  let normalized: string;
  if (body.includes(',')) {
    // BR: pontos = milhar, vírgula = decimal
    normalized = body.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+\.\d{1,2}$/.test(body)) {
    // US decimal curto
    normalized = body;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(body)) {
    // só milhares com ponto, sem decimal
    normalized = body.replace(/\./g, '');
  } else {
    normalized = body.replace(/[^\d.]/g, '');
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

/** Converte `YYYY-MM-DD` → `dd/mm/yyyy` para exibição. */
export function formatIsoDateBr(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Converte `dd/mm/yyyy` (com ou sem máscara parcial) → `YYYY-MM-DD`, ou `null`. */
export function parseBrDateToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Máscara progressiva `dd/mm/yyyy` a partir de dígitos ou texto parcial. */
export function maskBrDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Normaliza valor monetário de formulário para string com ponto decimal
 * (`1234.56`), aceitando vírgula BR. Retorna `''` se vazio.
 */
export function normalizeMoneyFormValue(raw: string): string {
  const cents = parseBrlToCents(raw);
  if (cents == null) return '';
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  // Âncora no dia 1 para obter ano/mês alvo sem overflow de dia (31/01 + 1 → fev, não 03/03).
  const anchor = new Date(Date.UTC(y, m - 1 + months, 1));
  const year = anchor.getUTCFullYear();
  const monthIndex = anchor.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export type AmortizationSystem = 'price' | 'sac' | 'fixed';

export interface AmortizationRow {
  number: number;
  dueOn: string;
  amountCents: number;
  interestCents: number;
  principalCents: number;
  balanceAfterCents: number;
}

export interface AmortizationSummary {
  system: AmortizationSystem;
  installmentCount: number;
  firstInstallmentCents: number;
  lastInstallmentCents: number;
  totalPaidCents: number;
  totalInterestCents: number;
  schedule: AmortizationRow[];
  /** Taxa a.a. em bps usada no cronograma (informada ou implícita no modo fixo). */
  annualRateBps?: number;
}

/** Taxa mensal nominal a partir de basis points anuais (padrão bancário BR: a.a. / 12). */
export function annualBpsToMonthlyRate(annualRateBps: number): number {
  return annualRateBps / 10_000 / 12;
}

export function monthlyRateToAnnualBps(monthlyRate: number): number {
  return Math.round(monthlyRate * 12 * 10_000);
}

function roundCents(value: number): number {
  return Math.round(value);
}

function pricePmtCents(
  principalCents: number,
  installmentCount: number,
  monthlyRate: number,
): number {
  if (installmentCount <= 0) return 0;
  if (monthlyRate === 0) return roundCents(principalCents / installmentCount);
  const factor = (1 + monthlyRate) ** installmentCount;
  return roundCents((principalCents * (monthlyRate * factor)) / (factor - 1));
}

/**
 * Resolve a taxa mensal implícita para que a parcela Price ≈ `pmtCents`.
 * Retorna null se a parcela for menor que a amortização sem juros (não quita o principal).
 */
export function solveMonthlyRateFromPmt(input: {
  principalCents: number;
  installmentCount: number;
  pmtCents: number;
}): number | null {
  const { principalCents, installmentCount, pmtCents } = input;
  if (principalCents <= 0 || installmentCount <= 0 || pmtCents <= 0) return null;

  const zeroRatePmt = principalCents / installmentCount;
  if (pmtCents + 0.5 < zeroRatePmt) return null;
  if (Math.abs(pmtCents - zeroRatePmt) < 0.5) return 0;

  let lo = 0;
  let hi = 1; // 100% a.m. — teto numérico
  // Garante que hi cubra o PMT desejado
  for (
    let expand = 0;
    expand < 20 && pricePmtCents(principalCents, installmentCount, hi) < pmtCents;
    expand += 1
  ) {
    hi *= 2;
  }
  if (pricePmtCents(principalCents, installmentCount, hi) < pmtCents) return null;

  for (let iter = 0; iter < 80; iter += 1) {
    const mid = (lo + hi) / 2;
    const calc = pricePmtCents(principalCents, installmentCount, mid);
    if (calc > pmtCents) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function summarizeSchedule(
  system: AmortizationSystem,
  schedule: AmortizationRow[],
  annualRateBps?: number,
): AmortizationSummary {
  if (schedule.length === 0) {
    return {
      system,
      installmentCount: 0,
      firstInstallmentCents: 0,
      lastInstallmentCents: 0,
      totalPaidCents: 0,
      totalInterestCents: 0,
      schedule: [],
      annualRateBps,
    };
  }
  const first = schedule[0]!;
  const last = schedule[schedule.length - 1]!;
  return {
    system,
    installmentCount: schedule.length,
    firstInstallmentCents: first.amountCents,
    lastInstallmentCents: last.amountCents,
    totalPaidCents: schedule.reduce((acc, row) => acc + row.amountCents, 0),
    totalInterestCents: schedule.reduce((acc, row) => acc + row.interestCents, 0),
    schedule,
    annualRateBps,
  };
}

/**
 * Tabela Price (Sistema Francês) — parcelas iguais; juros decrescentes, amortização crescente.
 * Usado em financiamentos de veículos e muitos empréstimos pessoais no Brasil.
 */
export function simulatePrice(input: {
  principalCents: number;
  installmentCount: number;
  annualRateBps: number;
  firstDueOn: string;
}): AmortizationSummary {
  const { principalCents, installmentCount, annualRateBps, firstDueOn } = input;
  const i = annualBpsToMonthlyRate(annualRateBps);
  let balance = principalCents;

  let pmt: number;
  if (i === 0) {
    pmt = roundCents(principalCents / installmentCount);
  } else {
    const factor = (1 + i) ** installmentCount;
    pmt = roundCents((principalCents * (i * factor)) / (factor - 1));
  }

  const schedule: AmortizationRow[] = [];
  for (let n = 1; n <= installmentCount; n += 1) {
    const interestCents = roundCents(balance * i);
    let principalPart = n === installmentCount ? balance : pmt - interestCents;
    if (principalPart > balance) principalPart = balance;
    const amountCents = n === installmentCount ? interestCents + principalPart : pmt;
    balance -= principalPart;
    if (balance < 0) balance = 0;
    schedule.push({
      number: n,
      dueOn: addMonths(firstDueOn, n - 1),
      amountCents,
      interestCents,
      principalCents: principalPart,
      balanceAfterCents: balance,
    });
  }

  return summarizeSchedule('price', schedule, annualRateBps);
}

/**
 * SAC (Sistema de Amortização Constante) — amortização fixa; parcelas decrescentes.
 * Padrão típico de financiamento imobiliário no Brasil.
 */
export function simulateSac(input: {
  principalCents: number;
  installmentCount: number;
  annualRateBps: number;
  firstDueOn: string;
}): AmortizationSummary {
  const { principalCents, installmentCount, annualRateBps, firstDueOn } = input;
  const i = annualBpsToMonthlyRate(annualRateBps);
  const amortization = roundCents(principalCents / installmentCount);
  let balance = principalCents;
  const schedule: AmortizationRow[] = [];

  for (let n = 1; n <= installmentCount; n += 1) {
    const interestCents = roundCents(balance * i);
    const principalPart = n === installmentCount ? balance : amortization;
    const amountCents = interestCents + principalPart;
    balance -= principalPart;
    if (balance < 0) balance = 0;
    schedule.push({
      number: n,
      dueOn: addMonths(firstDueOn, n - 1),
      amountCents,
      interestCents,
      principalCents: principalPart,
      balanceAfterCents: balance,
    });
  }

  return summarizeSchedule('sac', schedule, annualRateBps);
}

/**
 * Parcela contratual fixa informada pelo usuário.
 * Monta o cronograma no estilo Price: a parcela é o valor real (juros + amortização).
 * Se a taxa não for informada, deriva a taxa implícita a partir de principal, prazo e parcela.
 */
export function simulateFixed(input: {
  principalCents: number;
  installmentCount: number;
  installmentAmountCents: number;
  firstDueOn: string;
  annualRateBps?: number;
}): AmortizationSummary {
  const { principalCents, installmentCount, installmentAmountCents, firstDueOn } = input;
  const pmt = installmentAmountCents;

  let monthlyRate = 0;
  let annualRateBps = input.annualRateBps;

  if (annualRateBps != null && annualRateBps > 0) {
    monthlyRate = annualBpsToMonthlyRate(annualRateBps);
  } else {
    const solved = solveMonthlyRateFromPmt({
      principalCents,
      installmentCount,
      pmtCents: pmt,
    });
    if (solved == null) {
      // Parcela insuficiente para o principal no prazo — amortiza o possível sem inventar juros.
      let balance = principalCents;
      const schedule: AmortizationRow[] = [];
      for (let n = 1; n <= installmentCount && balance > 0; n += 1) {
        const principalPart = Math.min(pmt, balance);
        balance -= principalPart;
        schedule.push({
          number: n,
          dueOn: addMonths(firstDueOn, n - 1),
          amountCents: principalPart,
          interestCents: 0,
          principalCents: principalPart,
          balanceAfterCents: Math.max(0, balance),
        });
      }
      return summarizeSchedule('fixed', schedule, 0);
    }
    monthlyRate = solved;
    annualRateBps = monthlyRateToAnnualBps(solved);
  }

  let balance = principalCents;
  const schedule: AmortizationRow[] = [];
  for (let n = 1; n <= installmentCount; n += 1) {
    const interestCents = roundCents(balance * monthlyRate);
    let principalPart = n === installmentCount ? balance : pmt - interestCents;
    if (principalPart < 0) principalPart = 0;
    if (principalPart > balance) principalPart = balance;
    const amountCents = n === installmentCount ? interestCents + principalPart : pmt;
    balance -= principalPart;
    if (balance < 0) balance = 0;
    schedule.push({
      number: n,
      dueOn: addMonths(firstDueOn, n - 1),
      amountCents,
      interestCents,
      principalCents: principalPart,
      balanceAfterCents: balance,
    });
  }

  return summarizeSchedule('fixed', schedule, annualRateBps);
}

export function buildAmortizationSchedule(input: {
  system: AmortizationSystem;
  principalCents: number;
  installmentCount: number;
  firstDueOn: string;
  annualRateBps?: number;
  installmentAmountCents?: number;
}): AmortizationSummary {
  if (input.system === 'price') {
    if (input.annualRateBps === undefined) {
      throw new Error('annualRateBps é obrigatório para Price');
    }
    return simulatePrice({
      principalCents: input.principalCents,
      installmentCount: input.installmentCount,
      annualRateBps: input.annualRateBps,
      firstDueOn: input.firstDueOn,
    });
  }
  if (input.system === 'sac') {
    if (input.annualRateBps === undefined) {
      throw new Error('annualRateBps é obrigatório para SAC');
    }
    return simulateSac({
      principalCents: input.principalCents,
      installmentCount: input.installmentCount,
      annualRateBps: input.annualRateBps,
      firstDueOn: input.firstDueOn,
    });
  }
  if (input.installmentAmountCents === undefined) {
    throw new Error('installmentAmountCents é obrigatório para parcela fixa');
  }
  return simulateFixed({
    principalCents: input.principalCents,
    installmentCount: input.installmentCount,
    installmentAmountCents: input.installmentAmountCents,
    firstDueOn: input.firstDueOn,
    annualRateBps: input.annualRateBps,
  });
}

/** @deprecated Prefer buildAmortizationSchedule — mantido para compatibilidade. */
export function buildInstallmentSchedule(input: {
  firstDueOn: string;
  installmentCount: number;
  installmentAmountCents: number;
}): Array<{ number: number; dueOn: string; amountCents: number }> {
  return simulateFixed({
    principalCents: input.installmentAmountCents * input.installmentCount,
    installmentCount: input.installmentCount,
    installmentAmountCents: input.installmentAmountCents,
    firstDueOn: input.firstDueOn,
  }).schedule.map(({ number, dueOn, amountCents }) => ({
    number,
    dueOn,
    amountCents,
  }));
}

/**
 * Recalcula o cronograma restante após amortização extraordinária (100% no principal).
 * - Price / parcela fixa: mantém o valor da parcela e reduz o prazo.
 * - SAC: mantém a amortização periódica e reduz o prazo.
 */
export function rebuildRemainingSchedule(input: {
  system: AmortizationSystem;
  balanceCents: number;
  firstDueOn: string;
  annualRateBps?: number;
  /** Valor da parcela a manter (Price / fixed). */
  installmentAmountCents?: number;
  /** Amortização periódica a manter (SAC). */
  amortizationCents?: number;
  maxInstallments?: number;
}): AmortizationSummary {
  const balanceCents = Math.max(0, Math.floor(input.balanceCents));
  if (balanceCents === 0) {
    return summarizeSchedule(input.system, [], input.annualRateBps);
  }

  const maxInstallments = input.maxInstallments ?? 600;
  const i =
    input.annualRateBps != null && input.annualRateBps > 0
      ? annualBpsToMonthlyRate(input.annualRateBps)
      : 0;

  if (input.system === 'sac') {
    const amortization =
      input.amortizationCents != null && input.amortizationCents > 0
        ? input.amortizationCents
        : roundCents(balanceCents / Math.min(12, maxInstallments));
    let balance = balanceCents;
    const schedule: AmortizationRow[] = [];
    for (let n = 1; n <= maxInstallments && balance > 0; n += 1) {
      const interestCents = roundCents(balance * i);
      const principalPart = Math.min(balance, amortization);
      const amountCents = interestCents + principalPart;
      balance -= principalPart;
      schedule.push({
        number: n,
        dueOn: addMonths(input.firstDueOn, n - 1),
        amountCents,
        interestCents,
        principalCents: principalPart,
        balanceAfterCents: Math.max(0, balance),
      });
    }
    return summarizeSchedule('sac', schedule, input.annualRateBps);
  }

  const pmt = input.installmentAmountCents;
  if (pmt == null || pmt <= 0) {
    throw new Error('installmentAmountCents é obrigatório para rebuild Price/fixo');
  }

  let balance = balanceCents;
  const schedule: AmortizationRow[] = [];
  for (let n = 1; n <= maxInstallments && balance > 0; n += 1) {
    const interestCents = roundCents(balance * i);
    let principalPart = pmt - interestCents;
    if (principalPart <= 0) {
      // Parcela não cobre juros: quita o que der do principal neste ciclo.
      principalPart = Math.min(balance, Math.max(0, pmt));
    }
    if (principalPart > balance) principalPart = balance;
    const amountCents = interestCents + principalPart;
    balance -= principalPart;
    schedule.push({
      number: n,
      dueOn: addMonths(input.firstDueOn, n - 1),
      amountCents,
      interestCents,
      principalCents: principalPart,
      balanceAfterCents: Math.max(0, balance),
    });
  }

  return summarizeSchedule(
    input.system === 'fixed' ? 'fixed' : 'price',
    schedule,
    input.annualRateBps,
  );
}

export const DEFAULT_EXPENSE_CATEGORIES: Array<{ name: string; children?: string[] }> = [
  { name: 'Moradia' },
  { name: 'Alimentação', children: ['Supermercado', 'Delivery'] },
  { name: 'Transporte' },
  { name: 'Saúde' },
  { name: 'Educação' },
  { name: 'Lazer' },
  { name: 'Assinaturas' },
  { name: 'Impostos/Taxas' },
  { name: 'Pessoal' },
  { name: 'Outros' },
];

export const DEFAULT_INCOME_CATEGORIES: string[] = [
  'Salário',
  'Freelance',
  'Rendimentos',
  'Reembolso',
  'Outros',
];

export const DEFAULT_CATEGORY_ALIASES: Record<string, string[]> = {
  Supermercado: ['mercado', 'super', 'compras'],
  Delivery: ['ifood', 'delivery', 'rappi'],
  Transporte: ['uber', '99', 'combustivel', 'gasolina', 'estacionamento', 'pedagio', 'nutag'],
  Moradia: ['aluguel', 'condominio', 'luz', 'internet', 'itens casa', 'eletrodomestico'],
  Assinaturas: [
    'streamming',
    'streaming',
    'netflix',
    'spotify',
    'amazon prime',
    'paramount',
    'comunicacao',
    'comunicação',
  ],
  Alimentação: ['restaurante', 'comida', 'almoco', 'almoço', 'jantar'],
  Lazer: ['games', 'diversao', 'diversão', 'entretenimento', 'viagem'],
  Pessoal: ['pet', 'pets', 'roupas', 'roupa', 'cosmeticos', 'cosméticos', 'presentes'],
  'Impostos/Taxas': ['impostos', 'imposto', 'taxa', 'das', 'contador'],
  Outros: ['sem categoria', 'outros', 'empresa'],
};

export {
  analyzeCategoryAttention,
  type AttentionKind,
  type AttentionMonthBucket,
  type AttentionSeverity,
  type AttentionSignal,
  type CategoryMonthPoint,
} from './attention';

export {
  dueOnForMonth,
  estimatePayableCents,
  incomeDueOnForMonth,
  PAYABLE_KIND_LABEL,
  resolvePayableKind,
  shiftYearMonth,
  shouldPromptIncomeReceipt,
  shouldPromptPendingIncomes,
  suggestAverageAmountCents,
  transactionStatusLabel,
  yearMonthFromIso,
  type PayableKind,
} from './payments';

export {
  ACCOUNT_KIND_LABEL,
  assertTransferAllowed,
  estimateMonthlyYieldCents,
  formatTransferRouteLabel,
  formatYieldLabel,
  YIELD_TYPE_LABEL,
  type AccountKind,
  type YieldType,
} from './wealth';

export {
  emailsMatchForInvite,
  inviteExpiresAt,
  INVITE_TTL_DAYS,
  isInviteExpired,
  MEMBER_ROLE_LABEL,
  normalizeInviteEmail,
} from './invites';
