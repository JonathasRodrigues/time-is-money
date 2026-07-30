/**
 * Client mutations via REST API (`@tim/api`). Drop-in replacements for former server actions.
 */
import { parseBrlToCents, normalizeMoneyFormValue } from '@tim/domain';
import {
  planKindSchema,
  roleSchema,
  themePreferenceSchema,
  transactionTypeSchema,
  type AccountKind,
  type PaymentRail,
} from '@tim/validators';
import { api } from '@/lib/api/endpoints';

const PAYMENT_RAILS: PaymentRail[] = ['pix', 'debit', 'ted', 'boleto', 'cash', 'other'];
const ACCOUNT_KINDS: AccountKind[] = ['cash', 'checking', 'savings', 'investment_pot'];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '');
}

function moneyCentsFromForm(formData: FormData, key: string): number {
  const raw = normalizeMoneyFormValue(str(formData, key));
  if (!raw) return 0;
  return parseBrlToCents(raw) ?? 0;
}

function optionalPaymentRailFromForm(formData: FormData, key: string): PaymentRail | undefined {
  const raw = str(formData, key).trim();
  if (raw === '') return undefined;
  return PAYMENT_RAILS.includes(raw as PaymentRail) ? (raw as PaymentRail) : undefined;
}

function optionalMoneyCentsFromForm(formData: FormData, key: string): number | null {
  const raw = normalizeMoneyFormValue(str(formData, key));
  if (!raw) return null;
  return parseBrlToCents(raw);
}

function parseAccountFormFields(formData: FormData): {
  kind: AccountKind;
  yieldType: 'none' | 'cdi' | 'fixed_annual';
  yieldBps: number | null;
  balanceCents: number;
  institutionId: string | null;
  parentAccountId: string | null;
  name: string;
  costCenterId: string;
} {
  const balanceRaw = str(formData, 'balance').trim();
  const yieldRaw = str(formData, 'yieldValue').trim();
  const yieldTypeRaw = str(formData, 'yieldType') || 'none';
  const yieldType =
    yieldTypeRaw === 'cdi' || yieldTypeRaw === 'fixed_annual' ? yieldTypeRaw : 'none';
  const kindRaw = str(formData, 'kind') || 'checking';
  const kind = ACCOUNT_KINDS.includes(kindRaw as AccountKind)
    ? (kindRaw as AccountKind)
    : 'checking';

  let yieldBps: number | null = null;
  if (yieldType !== 'none' && yieldRaw !== '') {
    yieldBps = Math.round(Number(yieldRaw.replace(',', '.')) * 100);
  }

  return {
    kind,
    yieldType,
    yieldBps,
    balanceCents: balanceRaw === '' ? 0 : Math.round(Number(balanceRaw.replace(',', '.')) * 100),
    institutionId: formData.get('institutionId') ? str(formData, 'institutionId') : null,
    parentAccountId: formData.get('parentAccountId') ? str(formData, 'parentAccountId') : null,
    name: str(formData, 'name'),
    costCenterId: str(formData, 'costCenterId'),
  };
}

function followRedirect(result: { redirectTo?: string }): void {
  if (result.redirectTo) {
    window.location.assign(result.redirectTo);
  }
}

export async function createHouseholdAction(name: string): Promise<{ householdId: string }> {
  const result = await api.households.create({ name: name.trim() || 'Minha casa' });
  return { householdId: result.householdId };
}

export async function createTransactionAction(formData: FormData): Promise<void> {
  const status = str(formData, 'status') || 'paid';
  const dateRaw = str(formData, 'date') || str(formData, 'occurredOn');
  const creditCardRaw = str(formData, 'creditCardId').trim();
  const paymentRailRaw = str(formData, 'paymentRail').trim();
  const paymentRail = PAYMENT_RAILS.includes(paymentRailRaw as PaymentRail)
    ? (paymentRailRaw as PaymentRail)
    : null;

  await api.transactions.create({
    costCenterId: str(formData, 'costCenterId'),
    categoryId: str(formData, 'categoryId'),
    accountId: str(formData, 'accountId'),
    creditCardId: creditCardRaw === '' ? null : creditCardRaw,
    paymentRail: creditCardRaw !== '' ? null : paymentRail,
    type: transactionTypeSchema.parse(str(formData, 'type')),
    status: status === 'pending' ? 'pending' : 'paid',
    amountCents: moneyCentsFromForm(formData, 'amount'),
    occurredOn: dateRaw,
    dueOn: dateRaw,
    description: str(formData, 'description') || undefined,
    notes: str(formData, 'notes') || undefined,
  });
}

export async function createCostCenterAction(formData: FormData): Promise<void> {
  await api.costCenters.create({
    name: str(formData, 'name'),
    color: str(formData, 'color') || undefined,
  });
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  await api.categories.create({
    name: str(formData, 'name'),
    type: transactionTypeSchema.parse(str(formData, 'type')),
    parentId: formData.get('parentId') ? str(formData, 'parentId') : null,
  });
}

export async function createInstitutionAction(formData: FormData): Promise<void> {
  await api.institutions.create({ name: str(formData, 'name') });
}

export async function setupBankAction(formData: FormData): Promise<void> {
  const includeCard = formData.get('includeCreditCard') === '1';
  const includeSavings = formData.get('includeSavings') === '1';
  const customName = str(formData, 'customName').trim();
  const cardLastFour = str(formData, 'cardLastFour').trim();
  const cardModeRaw = str(formData, 'cardMode').trim();
  const cardMode =
    cardModeRaw === 'credit' || cardModeRaw === 'debit' || cardModeRaw === 'both'
      ? cardModeRaw
      : 'both';
  const hasCredit = cardMode === 'credit' || cardMode === 'both';
  const limitRaw = str(formData, 'creditLimit').trim();
  const invoiceRaw = str(formData, 'invoiceBalance').trim();
  const balanceRaw = str(formData, 'balance').trim();
  const savingsBalanceRaw = str(formData, 'savingsBalance').trim();
  const savingsName = str(formData, 'savingsName').trim();

  await api.institutions.setup({
    catalogId: str(formData, 'catalogId'),
    customName: customName === '' ? undefined : customName,
    costCenterId: str(formData, 'costCenterId'),
    accountName: str(formData, 'accountName') || 'Conta corrente',
    balanceCents: balanceRaw === '' ? 0 : Math.round(Number(balanceRaw.replace(',', '.')) * 100),
    includeSavings,
    savingsName: includeSavings ? (savingsName === '' ? 'Poupança' : savingsName) : undefined,
    savingsBalanceCents:
      !includeSavings || savingsBalanceRaw === ''
        ? 0
        : Math.round(Number(savingsBalanceRaw.replace(',', '.')) * 100),
    includeCreditCard: includeCard,
    cardMode: includeCard ? cardMode : 'both',
    cardName: includeCard ? str(formData, 'cardName') : undefined,
    cardLastFour: includeCard ? (cardLastFour === '' ? null : cardLastFour) : undefined,
    creditLimitCents:
      !includeCard || !hasCredit || limitRaw === ''
        ? 0
        : Math.round(Number(limitRaw.replace(',', '.')) * 100),
    invoiceBalanceCents:
      !includeCard || !hasCredit || invoiceRaw === ''
        ? 0
        : Math.round(Number(invoiceRaw.replace(',', '.')) * 100),
    closingDay: includeCard && hasCredit ? Number(formData.get('closingDay') ?? 1) : 1,
    dueDay: includeCard && hasCredit ? Number(formData.get('dueDay') ?? 10) : 10,
  });
}

export async function updateInstitutionAction(formData: FormData): Promise<void> {
  await api.institutions.update(str(formData, 'institutionId'), {
    name: str(formData, 'name'),
  });
}

export async function createAccountAction(formData: FormData): Promise<void> {
  await api.accounts.create(parseAccountFormFields(formData));
}

/** Cria corrente e/ou poupança (e dinheiro), com cartão/reserva opcionais na conta. */
export async function createBankAccountsAction(formData: FormData): Promise<void> {
  const includeChecking = formData.get('includeChecking') === '1';
  const includeSavings = formData.get('includeSavings') === '1';
  const includeCash = formData.get('includeCash') === '1';
  const includeCard = formData.get('includeCreditCard') === '1';
  const includePot = formData.get('includePot') === '1';
  const costCenterId = str(formData, 'costCenterId');
  const institutionRaw = str(formData, 'institutionId').trim();
  const institutionId = institutionRaw === '' ? null : institutionRaw;

  if (!includeChecking && !includeSavings && !includeCash) {
    throw new Error('Marque ao menos uma conta para criar');
  }

  if (includeCard && !includeChecking && !includeSavings && !includeCash) {
    throw new Error('Cartão precisa de uma conta vinculada');
  }

  if (includeCard && !institutionId) {
    throw new Error(
      'Cartão precisa de um banco — selecione a conta corrente ou poupança com banco',
    );
  }

  if (includePot && !includeChecking && !includeSavings && !includeCash) {
    throw new Error('Reserva precisa de uma conta pai');
  }

  let paymentAccountId: string | null = null;

  if (includeChecking) {
    const created = await api.accounts.create({
      costCenterId,
      name: str(formData, 'checkingName').trim() || 'Conta corrente',
      kind: 'checking',
      institutionId,
      balanceCents: moneyCentsFromForm(formData, 'checkingBalance'),
      yieldType: 'none',
    });
    paymentAccountId = created.id;
  }

  if (includeSavings) {
    const created = await api.accounts.create({
      costCenterId,
      name: str(formData, 'savingsName').trim() || 'Poupança',
      kind: 'savings',
      institutionId,
      balanceCents: moneyCentsFromForm(formData, 'savingsBalance'),
      yieldType: 'none',
    });
    if (!paymentAccountId) paymentAccountId = created.id;
  }

  if (includeCash) {
    const created = await api.accounts.create({
      costCenterId,
      name: str(formData, 'cashName').trim() || 'Dinheiro',
      kind: 'cash',
      institutionId: null,
      balanceCents: moneyCentsFromForm(formData, 'cashBalance'),
      yieldType: 'none',
    });
    if (!paymentAccountId) paymentAccountId = created.id;
  }

  if (includePot) {
    if (!paymentAccountId) {
      throw new Error('Reserva precisa de uma conta pai');
    }
    await api.accounts.create({
      costCenterId,
      name: str(formData, 'potName').trim() || 'Reserva',
      kind: 'investment_pot',
      institutionId,
      parentAccountId: paymentAccountId,
      balanceCents: moneyCentsFromForm(formData, 'potBalance'),
      yieldType: 'none',
    });
  }

  if (includeCard) {
    if (!paymentAccountId || !institutionId) {
      throw new Error('Não foi possível vincular o cartão à conta');
    }
    const cardMode = parseCardMode(formData);
    const hasCredit = cardMode === 'credit' || cardMode === 'both';
    const lastFourRaw = str(formData, 'cardLastFour').trim();
    await api.creditCards.create({
      institutionId,
      paymentAccountId,
      name: str(formData, 'cardName').trim() || 'Cartão',
      cardMode,
      lastFour: lastFourRaw === '' ? null : lastFourRaw,
      creditLimitCents: hasCredit ? moneyCentsFromForm(formData, 'creditLimit') : 0,
      invoiceBalanceCents: hasCredit ? moneyCentsFromForm(formData, 'invoiceBalance') : 0,
      closingDay: hasCredit ? Number(formData.get('closingDay') ?? 1) : 1,
      dueDay: hasCredit ? Number(formData.get('dueDay') ?? 10) : 1,
    });
  }
}

export async function updateAccountAction(formData: FormData): Promise<void> {
  await api.accounts.update(str(formData, 'accountId'), parseAccountFormFields(formData));
}

export async function updateAccountBalanceAction(formData: FormData): Promise<void> {
  await api.accounts.updateBalance(str(formData, 'accountId'), {
    balanceCents: Math.round(Number(str(formData, 'balance').replace(',', '.')) * 100),
  });
}

function parseCardMode(formData: FormData): 'credit' | 'debit' | 'both' {
  const raw = str(formData, 'cardMode').trim();
  if (raw === 'credit' || raw === 'debit' || raw === 'both') return raw;
  return 'credit';
}

export async function createCreditCardAction(formData: FormData): Promise<void> {
  const lastFourRaw = str(formData, 'lastFour').trim();
  const cardMode = parseCardMode(formData);
  const hasCredit = cardMode === 'credit' || cardMode === 'both';
  const limitRaw = str(formData, 'creditLimit').trim();
  const invoiceRaw = str(formData, 'invoiceBalance').trim();
  await api.creditCards.create({
    institutionId: str(formData, 'institutionId'),
    paymentAccountId: str(formData, 'paymentAccountId'),
    name: str(formData, 'name'),
    cardMode,
    lastFour: lastFourRaw === '' ? null : lastFourRaw,
    creditLimitCents:
      !hasCredit || limitRaw === '' ? 0 : Math.round(Number(limitRaw.replace(',', '.')) * 100),
    invoiceBalanceCents:
      !hasCredit || invoiceRaw === '' ? 0 : Math.round(Number(invoiceRaw.replace(',', '.')) * 100),
    closingDay: hasCredit ? Number(formData.get('closingDay') ?? 1) : 1,
    dueDay: hasCredit ? Number(formData.get('dueDay') ?? 10) : 1,
  });
}

export async function updateCreditCardAction(formData: FormData): Promise<void> {
  const lastFourRaw = str(formData, 'lastFour').trim();
  const cardMode = parseCardMode(formData);
  const hasCredit = cardMode === 'credit' || cardMode === 'both';
  const limitRaw = str(formData, 'creditLimit').trim();
  const invoiceRaw = str(formData, 'invoiceBalance').trim();
  await api.creditCards.update(str(formData, 'creditCardId'), {
    institutionId: str(formData, 'institutionId'),
    paymentAccountId: str(formData, 'paymentAccountId'),
    name: str(formData, 'name'),
    cardMode,
    lastFour: lastFourRaw === '' ? null : lastFourRaw,
    creditLimitCents:
      !hasCredit || limitRaw === '' ? 0 : Math.round(Number(limitRaw.replace(',', '.')) * 100),
    invoiceBalanceCents:
      !hasCredit || invoiceRaw === '' ? 0 : Math.round(Number(invoiceRaw.replace(',', '.')) * 100),
    closingDay: hasCredit ? Number(formData.get('closingDay') ?? 1) : 1,
    dueDay: hasCredit ? Number(formData.get('dueDay') ?? 10) : 1,
  });
}

export async function payCreditCardInvoiceAction(formData: FormData): Promise<void> {
  const paymentAccountRaw =
    str(formData, 'paymentAccountId').trim() || str(formData, 'accountId').trim();
  await api.creditCards.payInvoice(str(formData, 'creditCardId'), {
    amountCents: moneyCentsFromForm(formData, 'amount'),
    paidOn: str(formData, 'paidOn'),
    paymentAccountId: paymentAccountRaw === '' ? undefined : paymentAccountRaw,
    paymentRail: optionalPaymentRailFromForm(formData, 'paymentRail') ?? 'pix',
  });
}

export async function payPayablesBulkAction(input: {
  items: Array<{
    kind: 'transaction' | 'credit_card_invoice';
    id: string;
    amountCents: number;
    paidOn: string;
    accountId?: string;
    creditCardId?: string;
    paymentRail?: PaymentRail;
    applyToBalance?: boolean;
  }>;
}): Promise<void> {
  const transactions: Array<{
    transactionId: string;
    amountCents: number;
    paidOn: string;
    accountId?: string;
    creditCardId?: string;
    paymentRail?: PaymentRail;
    applyToBalance?: boolean;
  }> = [];

  for (const item of input.items) {
    if (item.kind === 'credit_card_invoice') {
      if (!item.creditCardId) {
        throw new Error('Fatura sem cartão');
      }
      await api.creditCards.payInvoice(item.creditCardId, {
        amountCents: item.amountCents,
        paidOn: item.paidOn,
        paymentAccountId: item.accountId,
        paymentRail: item.paymentRail ?? 'pix',
      });
      continue;
    }
    transactions.push({
      transactionId: item.id,
      amountCents: item.amountCents,
      paidOn: item.paidOn,
      accountId: item.accountId,
      creditCardId: item.creditCardId,
      paymentRail: item.paymentRail,
      applyToBalance: item.applyToBalance,
    });
  }

  if (transactions.length > 0) {
    await api.transactions.payBulk({ items: transactions });
  }
}

export async function createTransferAction(formData: FormData): Promise<void> {
  const descriptionRaw = str(formData, 'description');
  await api.transfers.create({
    fromAccountId: str(formData, 'fromAccountId'),
    toAccountId: str(formData, 'toAccountId'),
    amountCents: moneyCentsFromForm(formData, 'amount'),
    occurredOn: str(formData, 'occurredOn'),
    description: descriptionRaw === '' ? undefined : descriptionRaw,
  });
}

export async function createFinancingAction(formData: FormData): Promise<void> {
  const systemRaw = str(formData, 'amortizationSystem') || 'fixed';
  const amortizationSystem =
    systemRaw === 'price' || systemRaw === 'sac' || systemRaw === 'fixed' ? systemRaw : 'fixed';
  const installmentRaw = str(formData, 'installmentAmount');
  const rateRaw = str(formData, 'annualRate');
  const categoryRaw = str(formData, 'category') || 'other';
  const category =
    categoryRaw === 'real_estate' ||
    categoryRaw === 'vehicle' ||
    categoryRaw === 'personal' ||
    categoryRaw === 'other'
      ? categoryRaw
      : 'other';

  await api.financings.create({
    costCenterId: str(formData, 'costCenterId'),
    accountId: str(formData, 'accountId'),
    name: str(formData, 'name'),
    institution: str(formData, 'institution') || undefined,
    principalCents: Math.round(Number(formData.get('principal')) * 100),
    installmentCount: Number(formData.get('installmentCount')),
    installmentAmountCents:
      installmentRaw === '' ? undefined : Math.round(Number(installmentRaw) * 100),
    firstDueOn: str(formData, 'firstDueOn'),
    annualRateBps: rateRaw === '' ? undefined : Math.round(Number(rateRaw.replace(',', '.')) * 100),
    amortizationSystem,
    category,
  });
}

export async function payInstallmentAction(formData: FormData): Promise<void> {
  const amountRaw = str(formData, 'amount');
  const extraRaw = str(formData, 'extraAmortization');
  const categoryId = str(formData, 'categoryId');
  await api.financings.payInstallment(str(formData, 'installmentId'), {
    paidOn: str(formData, 'paidOn'),
    categoryId: categoryId === '' ? undefined : categoryId,
    amountCents: amountRaw === '' ? undefined : moneyCentsFromForm(formData, 'amount'),
    extraAmortizationCents:
      extraRaw === '' ? undefined : moneyCentsFromForm(formData, 'extraAmortization'),
  });
}

export async function payInstallmentsBulkAction(formData: FormData): Promise<void> {
  const ids = formData.getAll('installmentId').map(String);
  const amounts = formData.getAll('amount').map(String);
  const paidOns = formData.getAll('paidOn').map(String);
  if (ids.length === 0) throw new Error('Selecione ao menos uma parcela');
  const categoryId = str(formData, 'categoryId');
  await api.financings.payInstallmentsBulk({
    categoryId: categoryId === '' ? undefined : categoryId,
    items: ids.map((installmentId, index) => ({
      installmentId,
      amountCents: Math.round(Number((amounts[index] ?? '0').replace(',', '.')) * 100),
      paidOn: paidOns[index] ?? '',
    })),
  });
}

export async function rebuildFinancingAction(formData: FormData): Promise<void> {
  const systemRaw = str(formData, 'amortizationSystem') || 'fixed';
  const amortizationSystem =
    systemRaw === 'price' || systemRaw === 'sac' || systemRaw === 'fixed' ? systemRaw : 'fixed';
  const installmentRaw = str(formData, 'installmentAmount');
  const rateRaw = str(formData, 'annualRate');
  await api.financings.rebuild(str(formData, 'financingId'), {
    name: str(formData, 'name'),
    institution: str(formData, 'institution') || undefined,
    principalCents: Math.round(Number(str(formData, 'principal').replace(',', '.')) * 100),
    installmentCount: Number(formData.get('installmentCount')),
    installmentAmountCents:
      installmentRaw === ''
        ? undefined
        : Math.round(Number(installmentRaw.replace(',', '.')) * 100),
    firstDueOn: str(formData, 'firstDueOn'),
    annualRateBps: rateRaw === '' ? undefined : Math.round(Number(rateRaw.replace(',', '.')) * 100),
    amortizationSystem,
  });
}

export async function deleteFinancingAction(formData: FormData): Promise<void> {
  await api.financings.delete(str(formData, 'financingId'));
}

export async function createPayableExpenseAction(formData: FormData): Promise<void> {
  const creditCardRaw = str(formData, 'creditCardId').trim();
  const dateRaw = str(formData, 'dueOn') || str(formData, 'date');
  const paymentRail = optionalPaymentRailFromForm(formData, 'paymentRail');
  const statusRaw = str(formData, 'status').trim();
  const status = statusRaw === 'paid' || creditCardRaw !== '' ? 'paid' : 'pending';

  if (status === 'paid') {
    const amountCents = moneyCentsFromForm(formData, 'amount');
    if (amountCents <= 0) {
      throw new Error('Informe o valor pago');
    }
    if (creditCardRaw === '' && !str(formData, 'accountId').trim()) {
      throw new Error('Escolha a forma de pagamento');
    }
    await api.transactions.create({
      costCenterId: str(formData, 'costCenterId'),
      categoryId: str(formData, 'categoryId'),
      accountId: str(formData, 'accountId'),
      creditCardId: creditCardRaw === '' ? null : creditCardRaw,
      paymentRail: creditCardRaw !== '' ? null : (paymentRail ?? 'pix'),
      type: 'expense',
      status: 'paid',
      amountCents,
      occurredOn: dateRaw,
      dueOn: dateRaw,
      description: str(formData, 'description') || undefined,
    });
    return;
  }

  const installmentsRaw = str(formData, 'installmentCount') || '1';
  const installmentCount = Math.max(1, Math.min(48, Number(installmentsRaw) || 1));
  await api.transactions.createPending({
    costCenterId: str(formData, 'costCenterId'),
    categoryId: str(formData, 'categoryId'),
    accountId: str(formData, 'accountId'),
    type: 'expense',
    paymentRail: paymentRail ?? null,
    amountCents: optionalMoneyCentsFromForm(formData, 'amount'),
    dueOn: dateRaw,
    description: str(formData, 'description'),
    installmentCount,
  });
}

/** Receita avulsa, a receber ou repetida por N meses (mesmo valor mensal). */
export async function createReceivableAction(formData: FormData): Promise<void> {
  const dateRaw = str(formData, 'dueOn') || str(formData, 'date');
  const statusRaw = str(formData, 'status').trim();
  const status = statusRaw === 'pending' ? 'pending' : 'paid';
  const installmentsRaw = str(formData, 'installmentCount') || '1';
  const installmentCount = Math.max(1, Math.min(48, Number(installmentsRaw) || 1));

  if (status === 'paid' || installmentCount === 1) {
    if (status === 'pending' && installmentCount === 1) {
      await api.transactions.createPending({
        costCenterId: str(formData, 'costCenterId'),
        categoryId: str(formData, 'categoryId'),
        accountId: str(formData, 'accountId'),
        type: 'income',
        amountCents: optionalMoneyCentsFromForm(formData, 'amount'),
        dueOn: dateRaw,
        description: str(formData, 'description'),
        installmentCount: 1,
      });
      return;
    }
    const amountCents = moneyCentsFromForm(formData, 'amount');
    if (amountCents <= 0) {
      throw new Error('Informe o valor');
    }
    await api.transactions.create({
      costCenterId: str(formData, 'costCenterId'),
      categoryId: str(formData, 'categoryId'),
      accountId: str(formData, 'accountId'),
      type: 'income',
      status: 'paid',
      amountCents,
      occurredOn: dateRaw,
      dueOn: dateRaw,
      description: str(formData, 'description') || undefined,
    });
    return;
  }

  const monthlyCents = optionalMoneyCentsFromForm(formData, 'amount');
  if (monthlyCents == null || monthlyCents <= 0) {
    throw new Error('Informe o valor mensal para gerar o ano');
  }
  await api.transactions.createPending({
    costCenterId: str(formData, 'costCenterId'),
    categoryId: str(formData, 'categoryId'),
    accountId: str(formData, 'accountId'),
    type: 'income',
    amountCents: monthlyCents * installmentCount,
    dueOn: dateRaw,
    description: str(formData, 'description'),
    installmentCount,
  });
}

export async function createPendingTransactionAction(formData: FormData): Promise<void> {
  const installmentsRaw = str(formData, 'installmentCount') || '1';
  const installmentCount = Math.max(1, Math.min(48, Number(installmentsRaw) || 1));
  await api.transactions.createPending({
    costCenterId: str(formData, 'costCenterId'),
    categoryId: str(formData, 'categoryId'),
    accountId: str(formData, 'accountId'),
    type: 'expense',
    paymentRail: optionalPaymentRailFromForm(formData, 'paymentRail') ?? null,
    amountCents: optionalMoneyCentsFromForm(formData, 'amount'),
    dueOn: str(formData, 'dueOn'),
    description: str(formData, 'description'),
    installmentCount,
  });
}

export async function createMonthlySeriesAction(formData: FormData): Promise<void> {
  const amountRaw = str(formData, 'defaultAmount');
  const materializeRaw = str(formData, 'materializeMonths').trim();
  const materializeMonths =
    materializeRaw === '' ? undefined : Math.max(1, Math.min(24, Number(materializeRaw) || 2));
  await api.transactions.createMonthlySeries({
    costCenterId: str(formData, 'costCenterId'),
    categoryId: str(formData, 'categoryId'),
    accountId: str(formData, 'accountId'),
    type: transactionTypeSchema.parse(str(formData, 'type') || 'expense'),
    paymentRail: optionalPaymentRailFromForm(formData, 'paymentRail') ?? null,
    description: str(formData, 'description'),
    dueDay: Number(formData.get('dueDay')),
    defaultAmountCents: amountRaw === '' ? null : Math.round(Number(amountRaw) * 100),
    materializeMonths,
  });
}

export async function payTransactionAction(formData: FormData): Promise<void> {
  const amountRaw = str(formData, 'amount');
  const accountRaw = str(formData, 'accountId').trim();
  const creditCardRaw = str(formData, 'creditCardId').trim();
  const payWithCard = creditCardRaw !== '';
  await api.transactions.pay(str(formData, 'transactionId'), {
    paidOn: str(formData, 'paidOn'),
    amountCents: amountRaw === '' ? undefined : moneyCentsFromForm(formData, 'amount'),
    accountId: payWithCard ? undefined : accountRaw === '' ? undefined : accountRaw,
    creditCardId: payWithCard ? creditCardRaw : undefined,
    paymentRail: payWithCard
      ? undefined
      : (optionalPaymentRailFromForm(formData, 'paymentRail') ?? 'pix'),
    applyToBalance: payWithCard ? false : true,
  });
}

export async function payTransactionsBulkAction(input: {
  items: Array<{
    transactionId: string;
    amountCents?: number;
    paidOn: string;
    accountId?: string;
    creditCardId?: string;
    paymentRail?: PaymentRail;
    applyToBalance?: boolean;
  }>;
}): Promise<void> {
  await api.transactions.payBulk({ items: input.items });
}

export async function updatePendingAmountAction(formData: FormData): Promise<void> {
  const amountRaw = str(formData, 'amount');
  await api.transactions.updatePendingAmount(str(formData, 'transactionId'), {
    amountCents: amountRaw === '' ? null : moneyCentsFromForm(formData, 'amount'),
  });
}

export async function updateTransactionAction(formData: FormData): Promise<void> {
  const amountRaw = str(formData, 'amount');
  await api.transactions.update(str(formData, 'transactionId'), {
    costCenterId: str(formData, 'costCenterId'),
    categoryId: str(formData, 'categoryId'),
    accountId: str(formData, 'accountId'),
    type: transactionTypeSchema.parse(str(formData, 'type')),
    status: str(formData, 'status') === 'pending' ? 'pending' : 'paid',
    amountCents: amountRaw === '' ? null : moneyCentsFromForm(formData, 'amount'),
    date: str(formData, 'date'),
    description: str(formData, 'description') || undefined,
  });
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  await api.transactions.delete(str(formData, 'transactionId'));
}

export async function confirmIncomeReceiptAction(): Promise<void> {
  followRedirect(await api.incomePrompt.confirm());
}

export async function confirmIncomeItemAction(formData: FormData): Promise<void> {
  const accountRaw = str(formData, 'accountId').trim();
  followRedirect(
    await api.incomePrompt.confirmItem({
      transactionId: str(formData, 'transactionId'),
      paidOn: str(formData, 'paidOn') || new Date().toISOString().slice(0, 10),
      amountCents: moneyCentsFromForm(formData, 'amount'),
      accountId: accountRaw === '' ? undefined : accountRaw,
      applyToBalance: formData.get('applyToBalance') === 'on',
    }),
  );
}

export async function snoozeIncomeReceiptAction(): Promise<void> {
  await api.incomePrompt.snooze();
}

export async function createPlanAction(input: {
  kind: 'travel' | 'financing_payoff' | 'real_estate_amortization' | 'custom';
  name: string;
  targetDate: string;
  linkedAccountId?: string | null;
  financingId?: string | null;
  monthlyTargetCents?: number | null;
  notes?: string;
  items: Array<{ label: string; amountCents: number; sortOrder?: number }>;
  contributions?: Array<{ dueOn: string; amountCents: number; sortOrder?: number }>;
  createLinkedAccount?: boolean;
  linkedAccountName?: string;
  linkedAccountCostCenterId?: string;
}): Promise<{ planId: string }> {
  const result = await api.planning.create({
    ...input,
    kind: planKindSchema.parse(input.kind),
  });
  return { planId: result.planId };
}

export async function upsertPlanItemsAction(input: {
  planId: string;
  items: Array<{ label: string; amountCents: number; sortOrder?: number }>;
}): Promise<void> {
  await api.planning.upsertItems(input.planId, { items: input.items });
}

export async function upsertPlanContributionsAction(input: {
  planId: string;
  monthlyTargetCents?: number | null;
  contributions: Array<{ dueOn: string; amountCents: number; sortOrder?: number }>;
}): Promise<void> {
  await api.planning.upsertContributions(input.planId, {
    monthlyTargetCents: input.monthlyTargetCents,
    contributions: input.contributions,
  });
}

export async function deletePlanAction(planId: string): Promise<void> {
  await api.planning.delete(planId);
}

export async function updatePreferencesAction(formData: FormData): Promise<void> {
  const incomeDayRaw = str(formData, 'incomeDay').trim();
  const incomeDayParsed =
    incomeDayRaw === '' ? null : Math.min(28, Math.max(1, Math.floor(Number(incomeDayRaw))));
  await api.preferences.update({
    emailDueReminders: formData.get('emailDueReminders') === 'on',
    windowsDays: str(formData, 'windowsDays')
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => !Number.isNaN(n)),
    weeklySummary: formData.get('weeklySummary') === 'on',
    ttsEnabled: formData.get('ttsEnabled') === 'on',
    theme: themePreferenceSchema.parse(str(formData, 'theme').trim() || 'system'),
    incomeDay: incomeDayParsed != null && Number.isFinite(incomeDayParsed) ? incomeDayParsed : null,
    defaultCostCenterId: formData.get('defaultCostCenterId')
      ? str(formData, 'defaultCostCenterId')
      : null,
    defaultAccountId: formData.get('defaultAccountId') ? str(formData, 'defaultAccountId') : null,
  });
}

export async function updateThemePreferenceAction(themeRaw: string): Promise<void> {
  await api.preferences.updateTheme({ theme: themePreferenceSchema.parse(themeRaw) });
}

// --- Members ---

export async function inviteMemberAction(formData: FormData): Promise<{
  inviteUrl: string;
  emailSent: boolean;
}> {
  return api.members.invite({
    email: str(formData, 'email'),
    role: roleSchema.parse(str(formData, 'role') || 'viewer'),
  });
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  await api.members.revokeInvite(str(formData, 'invitationId'));
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  await api.members.updateRole(str(formData, 'membershipId'), {
    role: roleSchema.parse(str(formData, 'role')),
  });
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  await api.members.remove(str(formData, 'membershipId'));
}

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const result = await api.invites.accept({ token: str(formData, 'token') });
  followRedirect(result);
}

export async function acceptInviteByIdAction(formData: FormData): Promise<void> {
  const result = await api.invites.acceptById({ invitationId: str(formData, 'invitationId') });
  followRedirect(result);
}

// --- Imex ---

export type {
  ImportPreviewResponse as ImportPreviewResult,
  ImportPreviewRowDto,
} from '@tim/api-contract';

export async function downloadTemplateAction(): Promise<{ csv: string }> {
  return api.imex.template();
}

export async function exportTransactionsAction(input: {
  format: 'csv' | 'xlsx';
  from?: string;
  to?: string;
}): Promise<{ base64: string; filename: string; format: 'csv' | 'xlsx' }> {
  return api.imex.export(input);
}

export async function previewImportAction(
  formData: FormData,
): Promise<import('@tim/api-contract').ImportPreviewResponse> {
  return api.imex.previewImport(formData);
}

export async function updateImportPreviewAction(
  input: import('@tim/validators').UpdateImportPreviewInput,
): Promise<{ updated: number }> {
  const { jobId, ...body } = input;
  return api.imex.updateImportPreview(jobId, body);
}

export async function commitImportAction(jobId: string): Promise<{
  created: number;
  skipped: number;
  errors: number;
}> {
  return api.imex.commitImport(jobId);
}

// --- Jarvis ---

export async function sendJarvisMessageAction(input: {
  content: string;
  source: 'text' | 'voice';
  threadId?: string;
}): Promise<import('@tim/api-contract').JarvisMessageResponse> {
  return api.jarvis.sendMessage(input);
}
