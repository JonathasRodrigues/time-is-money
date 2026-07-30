import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('member_role', ['admin', 'editor', 'viewer']);
export const invitationStatusEnum = pgEnum('invitation_status', ['pending', 'accepted', 'revoked']);
export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense']);
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'paid']);
export const seriesIntervalEnum = pgEnum('series_interval', ['monthly']);
export const installmentStatusEnum = pgEnum('installment_status', ['pending', 'paid', 'skipped']);
export const amortizationSystemEnum = pgEnum('amortization_system', ['price', 'sac', 'fixed']);
export const financingCategoryEnum = pgEnum('financing_category', [
  'real_estate',
  'vehicle',
  'personal',
  'other',
]);
export const planKindEnum = pgEnum('plan_kind', [
  'travel',
  'financing_payoff',
  'real_estate_amortization',
  'custom',
]);
export const importStatusEnum = pgEnum('import_status', [
  'pending',
  'preview',
  'processing',
  'completed',
  'failed',
]);
export const importRowStatusEnum = pgEnum('import_row_status', ['ok', 'error', 'skip']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
export const messageSourceEnum = pgEnum('message_source', ['text', 'voice']);

export const households = pgTable('households', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  clerkOrgId: varchar('clerk_org_id', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 }).notNull(),
    email: varchar('email', { length: 255 }),
    role: roleEnum('role').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('memberships_household_user_uidx').on(table.householdId, table.userId)],
);

export const householdInvitations = pgTable(
  'household_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: roleEnum('role').notNull().default('viewer'),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    invitedByUserId: varchar('invited_by_user_id', { length: 128 }).notNull(),
    status: invitationStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('household_invitations_token_hash_uidx').on(table.tokenHash),
    index('household_invitations_household_status_idx').on(table.householdId, table.status),
  ],
);

export const costCenters = pgTable('cost_centers', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  color: varchar('color', { length: 32 }),
  isSystem: boolean('is_system').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  name: varchar('name', { length: 120 }).notNull(),
  type: transactionTypeEnum('type').notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const categoryAliases = pgTable('category_aliases', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  alias: varchar('alias', { length: 120 }).notNull(),
});

export const accountKindEnum = pgEnum('account_kind', [
  'cash',
  'checking',
  'savings',
  'investment_pot',
]);
export const yieldTypeEnum = pgEnum('yield_type', ['none', 'cdi', 'fixed_annual']);
export const cardModeEnum = pgEnum('card_mode', ['credit', 'debit', 'both']);
export const creditCardInvoiceStatusEnum = pgEnum('credit_card_invoice_status', [
  'open',
  'closed',
  'paid',
]);

export const institutions = pgTable('institutions', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  costCenterId: uuid('cost_center_id')
    .notNull()
    .references(() => costCenters.id, { onDelete: 'cascade' }),
  institutionId: uuid('institution_id').references(() => institutions.id, {
    onDelete: 'set null',
  }),
  parentAccountId: uuid('parent_account_id').references((): AnyPgColumn => accounts.id, {
    onDelete: 'set null',
  }),
  name: varchar('name', { length: 120 }).notNull(),
  kind: accountKindEnum('kind').notNull().default('checking'),
  /** Saldo informado (snapshot manual). */
  balanceCents: integer('balance_cents').notNull().default(0),
  yieldType: yieldTypeEnum('yield_type').notNull().default('none'),
  /**
   * CDI: bps do CDI (10000 = 100% CDI).
   * fixed_annual: taxa a.a. em bps (1200 = 12% a.a.).
   */
  yieldBps: integer('yield_bps'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Cartão de crédito (passivo): limite + saldo da fatura aberta. */
export const creditCards = pgTable(
  'credit_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'restrict' }),
    /** Conta corrente (ou outra) usada para pagar a fatura. */
    paymentAccountId: uuid('payment_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    lastFour: varchar('last_four', { length: 4 }),
    /** Crédito, débito ou os dois (cartão combo). */
    cardMode: cardModeEnum('card_mode').notNull().default('credit'),
    creditLimitCents: integer('credit_limit_cents').notNull().default(0),
    /** Saldo atual da fatura (quanto deve). */
    invoiceBalanceCents: integer('invoice_balance_cents').notNull().default(0),
    closingDay: integer('closing_day').notNull(),
    dueDay: integer('due_day').notNull(),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('credit_cards_household_idx').on(table.householdId)],
);

/** Ciclo de fatura do cartão (fechamento → vencimento). */
export const creditCardInvoices = pgTable(
  'credit_card_invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    creditCardId: uuid('credit_card_id')
      .notNull()
      .references(() => creditCards.id, { onDelete: 'cascade' }),
    closesOn: varchar('closes_on', { length: 10 }).notNull(),
    dueOn: varchar('due_on', { length: 10 }).notNull(),
    status: creditCardInvoiceStatusEnum('status').notNull().default('open'),
    /** Total já liquidado nesta fatura (pagamentos parciais). */
    amountPaidCents: integer('amount_paid_cents').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('credit_card_invoices_household_idx').on(table.householdId),
    index('credit_card_invoices_card_idx').on(table.creditCardId),
    uniqueIndex('credit_card_invoices_card_closes_uidx').on(table.creditCardId, table.closesOn),
  ],
);

export const accountTransfers = pgTable(
  'account_transfers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    fromAccountId: uuid('from_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    toAccountId: uuid('to_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    amountCents: integer('amount_cents').notNull(),
    occurredOn: varchar('occurred_on', { length: 10 }).notNull(),
    description: varchar('description', { length: 500 }),
    createdBy: varchar('created_by', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('account_transfers_household_occurred_idx').on(table.householdId, table.occurredOn),
  ],
);

export const transactionSeries = pgTable('transaction_series', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  costCenterId: uuid('cost_center_id')
    .notNull()
    .references(() => costCenters.id),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id),
  type: transactionTypeEnum('type').notNull().default('expense'),
  description: varchar('description', { length: 500 }).notNull(),
  interval: seriesIntervalEnum('interval').notNull().default('monthly'),
  dueDay: integer('due_day').notNull(),
  defaultAmountCents: integer('default_amount_cents'),
  defaultPaymentRail: varchar('default_payment_rail', { length: 16 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    costCenterId: uuid('cost_center_id')
      .notNull()
      .references(() => costCenters.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    /** Se preenchido, despesa no cartão (aumenta fatura; não mexe no saldo da conta). */
    creditCardId: uuid('credit_card_id').references(() => creditCards.id, {
      onDelete: 'set null',
    }),
    /** Ciclo de fatura que recebeu a compra no cartão. */
    creditCardInvoiceId: uuid('credit_card_invoice_id').references(() => creditCardInvoices.id, {
      onDelete: 'set null',
    }),
    /** Meio de pagamento na conta: pix | debit | ted | boleto | cash | other. */
    paymentRail: varchar('payment_rail', { length: 16 }),
    type: transactionTypeEnum('type').notNull(),
    status: transactionStatusEnum('status').notNull().default('paid'),
    amountCents: integer('amount_cents'),
    occurredOn: varchar('occurred_on', { length: 10 }).notNull(),
    dueOn: varchar('due_on', { length: 10 }),
    paidOn: varchar('paid_on', { length: 10 }),
    description: varchar('description', { length: 500 }),
    notesEncrypted: text('notes_encrypted'),
    tags: jsonb('tags').$type<string[]>().default([]),
    source: varchar('source', { length: 32 }).notNull().default('manual'),
    seriesId: uuid('series_id').references(() => transactionSeries.id, {
      onDelete: 'set null',
    }),
    installmentId: uuid('installment_id'),
    duplicateHash: varchar('duplicate_hash', { length: 64 }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdBy: varchar('created_by', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('transactions_installment_uidx').on(table.installmentId)],
);

export const financings = pgTable('financings', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  costCenterId: uuid('cost_center_id')
    .notNull()
    .references(() => costCenters.id),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id),
  name: varchar('name', { length: 160 }).notNull(),
  institution: varchar('institution', { length: 160 }),
  principalCents: integer('principal_cents').notNull(),
  installmentCount: integer('installment_count').notNull(),
  installmentAmountCents: integer('installment_amount_cents').notNull(),
  annualRateBps: integer('annual_rate_bps'),
  amortizationSystem: amortizationSystemEnum('amortization_system').notNull().default('fixed'),
  category: financingCategoryEnum('category').notNull().default('other'),
  firstDueOn: varchar('first_due_on', { length: 10 }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    kind: planKindEnum('kind').notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    targetDate: varchar('target_date', { length: 10 }).notNull(),
    linkedAccountId: uuid('linked_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    financingId: uuid('financing_id').references(() => financings.id, {
      onDelete: 'set null',
    }),
    /** Aporte mensal de referência da estratégia. */
    monthlyTargetCents: integer('monthly_target_cents'),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('plans_household_deleted_idx').on(table.householdId, table.deletedAt)],
);

export const planItems = pgTable(
  'plan_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 120 }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('plan_items_plan_idx').on(table.planId, table.sortOrder)],
);

export const planContributions = pgTable(
  'plan_contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    dueOn: varchar('due_on', { length: 10 }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('plan_contributions_plan_idx').on(table.planId, table.sortOrder)],
);

export const installments = pgTable('installments', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  financingId: uuid('financing_id')
    .notNull()
    .references(() => financings.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  dueOn: varchar('due_on', { length: 10 }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  interestCents: integer('interest_cents').notNull().default(0),
  principalCents: integer('principal_cents').notNull().default(0),
  balanceAfterCents: integer('balance_after_cents').notNull().default(0),
  status: installmentStatusEnum('status').notNull().default('pending'),
  paidOn: varchar('paid_on', { length: 10 }),
  transactionId: uuid('transaction_id').references(() => transactions.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 128 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  resourceType: varchar('resource_type', { length: 64 }).notNull(),
  resourceId: varchar('resource_id', { length: 64 }),
  source: varchar('source', { length: 32 }).notNull().default('app'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userPreferences = pgTable(
  'user_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 }).notNull(),
    defaultCostCenterId: uuid('default_cost_center_id'),
    defaultAccountId: uuid('default_account_id'),
    emailDueReminders: boolean('email_due_reminders').notNull().default(true),
    reminderWindowsDays: jsonb('reminder_windows_days').$type<number[]>().default([7, 3, 1]),
    weeklySummary: boolean('weekly_summary').notNull().default(false),
    ttsEnabled: boolean('tts_enabled').notNull().default(false),
    /** Tema da UI: light | dark | system. */
    theme: varchar('theme', { length: 16 }).notNull().default('system'),
    /** Dia do mês (1–28) em que costuma cair o recebimento (salário etc.). */
    incomeDay: integer('income_day'),
    /** Último mês (YYYY-MM) em que o usuário confirmou o recebimento. */
    lastIncomeConfirmedMonth: varchar('last_income_confirmed_month', { length: 7 }),
    /** Data (YYYY-MM-DD) em que o usuário adiou o prompt (“ainda não”). */
    incomePromptSnoozedOn: varchar('income_prompt_snoozed_on', { length: 10 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_prefs_household_user_uidx').on(table.householdId, table.userId)],
);

export const notificationOutbox = pgTable(
  'notification_outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 }).notNull(),
    kind: varchar('kind', { length: 64 }).notNull(),
    referenceId: varchar('reference_id', { length: 64 }).notNull(),
    windowDays: integer('window_days').notNull(),
    sentOn: varchar('sent_on', { length: 10 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('notification_outbox_uidx').on(
      table.userId,
      table.kind,
      table.referenceId,
      table.windowDays,
      table.sentOn,
    ),
  ],
);

export const jarvisThreads = pgTable('jarvis_threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 128 }).notNull(),
  title: varchar('title', { length: 160 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const jarvisMessages = pgTable('jarvis_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => jarvisThreads.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  source: messageSourceEnum('source').notNull().default('text'),
  content: text('content').notNull(),
  intent: jsonb('intent').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const importJobs = pgTable('import_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 128 }).notNull(),
  status: importStatusEnum('status').notNull().default('pending'),
  fileName: varchar('file_name', { length: 255 }),
  format: varchar('format', { length: 16 }).notNull(),
  mapping: jsonb('mapping').$type<Record<string, string>>().default({}),
  errorSummary: text('error_summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const importJobRows = pgTable('import_job_rows', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => importJobs.id, { onDelete: 'cascade' }),
  rowNumber: integer('row_number').notNull(),
  status: importRowStatusEnum('status').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
  reason: text('reason'),
});

export const exportJobs = pgTable('export_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 128 }).notNull(),
  format: varchar('format', { length: 16 }).notNull(),
  filters: jsonb('filters').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
