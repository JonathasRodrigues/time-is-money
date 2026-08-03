import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'editor', 'viewer']);

export const moneyCentsSchema = z
  .number()
  .int('Valor deve ser inteiro em centavos')
  .positive('Valor deve ser positivo');

export const optionalMoneyCentsSchema = z
  .number()
  .int('Valor deve ser inteiro em centavos')
  .positive('Valor deve ser positivo')
  .nullable()
  .optional();

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD');

export const transactionTypeSchema = z.enum(['income', 'expense']);
export const transactionStatusSchema = z.enum(['pending', 'paid']);

export const paymentRailSchema = z.enum(['pix', 'debit', 'ted', 'boleto', 'cash', 'other']);

export const instantAccountPaymentRailSchema = z.enum(['pix', 'debit', 'ted', 'boleto']);

/** Rails permitidos na conta; array vazio = sem formas de pagamento. */
export const allowedPaymentRailsSchema = z.array(instantAccountPaymentRailSchema);

export const accountKindSchema = z.enum(['cash', 'checking', 'savings', 'investment_pot']);

export const cardModeSchema = z.enum(['credit', 'debit', 'both']);

export const createTransactionSchema = z
  .object({
    householdId: z.string().uuid(),
    costCenterId: z.string().uuid(),
    categoryId: z.string().uuid(),
    accountId: z.string().uuid(),
    creditCardId: z.string().uuid().nullable().optional(),
    paymentRail: paymentRailSchema.nullable().optional(),
    paymentMethodId: z.string().uuid().nullable().optional(),
    type: transactionTypeSchema,
    status: transactionStatusSchema.optional(),
    amountCents: moneyCentsSchema,
    occurredOn: isoDateSchema,
    /** Vencimento; se omitido, usa occurredOn. */
    dueOn: isoDateSchema.optional(),
    description: z.string().max(500).optional(),
    notes: z.string().max(5000).optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
  })
  .superRefine((data, ctx) => {
    const status = data.status ?? 'paid';
    if (status === 'pending' && data.creditCardId) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Compra no cartão deve ser registrada como já paga — entra na fatura do ciclo, não em contas a pagar.',
        path: ['creditCardId'],
      });
    }
  });

export const createPendingTransactionSchema = z
  .object({
    householdId: z.string().uuid(),
    costCenterId: z.string().uuid(),
    categoryId: z.string().uuid(),
    accountId: z.string().uuid(),
    type: transactionTypeSchema.default('expense'),
    /** Meio previsto na quitação (PIX/débito/TED). */
    paymentRail: paymentRailSchema.nullable().optional(),
    amountCents: optionalMoneyCentsSchema,
    dueOn: isoDateSchema,
    description: z.string().min(1).max(500),
    notes: z.string().max(5000).optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
    /** 1 = avulso; >1 gera N lançamentos mensais (ex.: mecânico 4x). */
    installmentCount: z.number().int().min(1).max(48).default(1),
  })
  .superRefine((data, ctx) => {
    if (data.installmentCount > 1 && (data.amountCents == null || data.amountCents <= 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe o valor total para parcelar',
        path: ['amountCents'],
      });
    }
  });

export const createMonthlySeriesSchema = z.object({
  householdId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid(),
  type: transactionTypeSchema.default('expense'),
  /** Meio previsto na quitação (PIX/débito/TED). */
  paymentRail: paymentRailSchema.nullable().optional(),
  description: z.string().min(1).max(500),
  dueDay: z.number().int().min(1).max(28),
  defaultAmountCents: optionalMoneyCentsSchema,
  /**
   * Quantos meses materializar a partir do mês atual (inclui o atual).
   * Default 2 (atual + próximo). Use 12 para cobrir ~um ano.
   */
  materializeMonths: z.number().int().min(1).max(24).optional(),
});

export const updatePendingAmountSchema = z.object({
  householdId: z.string().uuid(),
  transactionId: z.string().uuid(),
  amountCents: moneyCentsSchema.nullable(),
});

/** Edição de lançamento no extrato (data, valor, classificação, status). */
export const updateTransactionSchema = z
  .object({
    householdId: z.string().uuid(),
    transactionId: z.string().uuid(),
    costCenterId: z.string().uuid(),
    categoryId: z.string().uuid(),
    accountId: z.string().uuid(),
    creditCardId: z.string().uuid().nullable().optional(),
    paymentRail: paymentRailSchema.nullable().optional(),
    paymentMethodId: z.string().uuid().nullable().optional(),
    type: transactionTypeSchema,
    status: transactionStatusSchema,
    amountCents: optionalMoneyCentsSchema,
    /** Data principal: pagamento/recebimento se pago; vencimento se pendente. */
    date: isoDateSchema,
    description: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'paid' && (data.amountCents == null || data.amountCents <= 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe o valor do lançamento pago',
        path: ['amountCents'],
      });
    }
  });

export const payTransactionSchema = z.object({
  householdId: z.string().uuid(),
  transactionId: z.string().uuid(),
  paidOn: isoDateSchema,
  amountCents: moneyCentsSchema.optional(),
  accountId: z.string().uuid().optional(),
  applyToBalance: z.boolean().optional(),
  paymentRail: paymentRailSchema.nullable().optional(),
  /** Pagar a obrigação com cartão de crédito (em vez da conta). */
  creditCardId: z.string().uuid().optional(),
});

export const payTransactionsBulkSchema = z.object({
  householdId: z.string().uuid(),
  items: z
    .array(
      z.object({
        transactionId: z.string().uuid(),
        amountCents: moneyCentsSchema.optional(),
        paidOn: isoDateSchema,
        accountId: z.string().uuid().optional(),
        applyToBalance: z.boolean().optional(),
        paymentRail: paymentRailSchema.nullable().optional(),
        creditCardId: z.string().uuid().optional(),
      }),
    )
    .min(1)
    .max(100),
});

export const createCostCenterSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().min(1).max(120),
  color: z.string().max(32).optional(),
});

export const createCategorySchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: transactionTypeSchema,
  parentId: z.string().uuid().nullable().optional(),
});

export const createAccountSchema = z.object({
  householdId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  name: z.string().min(1).max(120),
  institutionId: z.string().uuid().nullable().optional(),
  parentAccountId: z.string().uuid().nullable().optional(),
  kind: accountKindSchema.default('checking'),
  balanceCents: z.number().int().min(0).default(0),
  yieldType: z.enum(['none', 'cdi', 'fixed_annual']).default('none'),
  yieldBps: z.number().int().min(0).max(100_000).nullable().optional(),
  allowedPaymentRails: allowedPaymentRailsSchema.optional(),
});

export const createInstitutionSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

/** Cadastro guiado: banco + corrente (+ poupança e cartão opcionais). */
export const setupBankSchema = z
  .object({
    householdId: z.string().uuid(),
    catalogId: z.string().min(1).max(40),
    customName: z.string().min(1).max(120).optional(),
    costCenterId: z.string().uuid(),
    accountName: z.string().min(1).max(120).default('Conta corrente'),
    balanceCents: z.number().int().min(0).default(0),
    includeSavings: z.boolean().default(false),
    savingsName: z.string().min(1).max(120).optional(),
    savingsBalanceCents: z.number().int().min(0).default(0),
    includeCreditCard: z.boolean().default(true),
    cardMode: cardModeSchema.default('both'),
    cardName: z.string().min(1).max(120).optional(),
    cardLastFour: z
      .string()
      .regex(/^\d{4}$/, 'Informe 4 dígitos')
      .nullable()
      .optional(),
    creditLimitCents: z.number().int().min(0).default(0),
    invoiceBalanceCents: z.number().int().min(0).default(0),
    closingDay: z.number().int().min(1).max(28).default(1),
    dueDay: z.number().int().min(1).max(28).default(10),
  })
  .superRefine((value, ctx) => {
    if (value.catalogId === 'custom' && !value.customName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o nome do banco',
        path: ['customName'],
      });
    }
    if (value.includeSavings && !value.savingsName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o nome da poupança',
        path: ['savingsName'],
      });
    }
    if (value.includeCreditCard && !value.cardName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o nome do cartão',
        path: ['cardName'],
      });
    }
  });

export const updateInstitutionSchema = z.object({
  householdId: z.string().uuid(),
  institutionId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

export const updateAccountBalanceSchema = z.object({
  householdId: z.string().uuid(),
  accountId: z.string().uuid(),
  balanceCents: z.number().int().min(0),
});

export const updateAccountSchema = z.object({
  householdId: z.string().uuid(),
  accountId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  name: z.string().min(1).max(120),
  institutionId: z.string().uuid().nullable().optional(),
  parentAccountId: z.string().uuid().nullable().optional(),
  kind: accountKindSchema,
  balanceCents: z.number().int().min(0),
  yieldType: z.enum(['none', 'cdi', 'fixed_annual']),
  yieldBps: z.number().int().min(0).max(100_000).nullable().optional(),
  allowedPaymentRails: allowedPaymentRailsSchema,
});

export const createCreditCardSchema = z.object({
  householdId: z.string().uuid(),
  institutionId: z.string().uuid(),
  paymentAccountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  cardMode: cardModeSchema.default('credit'),
  lastFour: z
    .string()
    .regex(/^\d{4}$/, 'Informe 4 dígitos')
    .nullable()
    .optional(),
  creditLimitCents: z.number().int().min(0).default(0),
  invoiceBalanceCents: z.number().int().min(0).default(0),
  closingDay: z.number().int().min(1).max(28),
  dueDay: z.number().int().min(1).max(28),
});

export const updateCreditCardSchema = z.object({
  householdId: z.string().uuid(),
  creditCardId: z.string().uuid(),
  institutionId: z.string().uuid(),
  paymentAccountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  cardMode: cardModeSchema,
  lastFour: z
    .string()
    .regex(/^\d{4}$/, 'Informe 4 dígitos')
    .nullable()
    .optional(),
  creditLimitCents: z.number().int().min(0),
  invoiceBalanceCents: z.number().int().min(0),
  closingDay: z.number().int().min(1).max(28),
  dueDay: z.number().int().min(1).max(28),
});

export const payCreditCardInvoiceSchema = z.object({
  householdId: z.string().uuid(),
  creditCardId: z.string().uuid(),
  amountCents: moneyCentsSchema,
  paidOn: isoDateSchema,
  /** Se omitido, usa a conta de pagamento padrão do cartão. */
  paymentAccountId: z.string().uuid().optional(),
  /** Meio usado para quitar a fatura (sai da conta). Default: pix. */
  paymentRail: paymentRailSchema.optional(),
});

export const createTransferSchema = z
  .object({
    householdId: z.string().uuid(),
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amountCents: moneyCentsSchema,
    occurredOn: isoDateSchema,
    description: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fromAccountId === data.toAccountId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Origem e destino devem ser contas diferentes',
        path: ['toAccountId'],
      });
    }
  });

export const amortizationSystemSchema = z.enum(['price', 'sac', 'fixed']);
export const financingCategorySchema = z.enum(['real_estate', 'vehicle', 'personal', 'other']);
export const planKindSchema = z.enum([
  'travel',
  'financing_payoff',
  'real_estate_amortization',
  'custom',
]);

export const planItemInputSchema = z.object({
  label: z.string().min(1).max(120),
  amountCents: moneyCentsSchema,
  sortOrder: z.number().int().min(0).optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const planContributionInputSchema = z.object({
  dueOn: isoDateSchema,
  amountCents: moneyCentsSchema,
  sortOrder: z.number().int().min(0).optional(),
});

export const createPlanSchema = z
  .object({
    householdId: z.string().uuid(),
    kind: planKindSchema,
    name: z.string().min(1).max(160),
    targetDate: isoDateSchema,
    linkedAccountId: z.string().uuid().nullable().optional(),
    financingId: z.string().uuid().nullable().optional(),
    monthlyTargetCents: z.number().int().min(0).nullable().optional(),
    notes: z.string().max(5000).optional(),
    items: z.array(planItemInputSchema).min(1).max(50),
    contributions: z.array(planContributionInputSchema).max(120).optional(),
    /** Cria caixinha automaticamente se linkedAccountId omitido. */
    createLinkedAccount: z.boolean().optional(),
    linkedAccountName: z.string().min(1).max(120).optional(),
    linkedAccountCostCenterId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'financing_payoff' && !data.financingId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Financiamento é obrigatório para planos de quitação',
        path: ['financingId'],
      });
    }
    if (data.kind === 'real_estate_amortization' && !data.financingId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Financiamento imobiliário é obrigatório para planos de amortização',
        path: ['financingId'],
      });
    }
    if (data.createLinkedAccount && !data.linkedAccountCostCenterId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Centro de custo é obrigatório ao criar caixinha',
        path: ['linkedAccountCostCenterId'],
      });
    }
  });

export const updatePlanSchema = z.object({
  householdId: z.string().uuid(),
  planId: z.string().uuid(),
  name: z.string().min(1).max(160).optional(),
  targetDate: isoDateSchema.optional(),
  linkedAccountId: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const upsertPlanItemsSchema = z.object({
  householdId: z.string().uuid(),
  planId: z.string().uuid(),
  items: z.array(planItemInputSchema).min(1).max(50),
});

export const upsertPlanContributionsSchema = z.object({
  householdId: z.string().uuid(),
  planId: z.string().uuid(),
  monthlyTargetCents: z.number().int().min(0).nullable().optional(),
  contributions: z.array(planContributionInputSchema).min(1).max(120),
});

export const softDeletePlanSchema = z.object({
  householdId: z.string().uuid(),
  planId: z.string().uuid(),
});

export const createFinancingSchema = z
  .object({
    householdId: z.string().uuid(),
    costCenterId: z.string().uuid(),
    accountId: z.string().uuid(),
    name: z.string().min(1).max(160),
    institution: z.string().max(160).optional(),
    principalCents: moneyCentsSchema,
    installmentCount: z.number().int().positive().max(600),
    installmentAmountCents: moneyCentsSchema.optional(),
    firstDueOn: isoDateSchema,
    annualRateBps: z.number().int().min(0).max(100_000).optional(),
    amortizationSystem: amortizationSystemSchema.default('fixed'),
    category: financingCategorySchema.default('other'),
  })
  .superRefine((data, ctx) => {
    if (data.amortizationSystem === 'fixed') {
      if (data.installmentAmountCents === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Valor da parcela é obrigatório no modo fixo',
          path: ['installmentAmountCents'],
        });
      }
      return;
    }
    if (data.annualRateBps === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Taxa anual é obrigatória para Price/SAC',
        path: ['annualRateBps'],
      });
    }
  });

export const payInstallmentSchema = z.object({
  householdId: z.string().uuid(),
  installmentId: z.string().uuid(),
  paidOn: isoDateSchema,
  amountCents: moneyCentsSchema.optional(),
  categoryId: z.string().uuid().optional(),
  /** Amortização extraordinária (100% principal) no mesmo pagamento. */
  extraAmortizationCents: moneyCentsSchema.optional(),
});

export const payInstallmentsBulkSchema = z.object({
  householdId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        installmentId: z.string().uuid(),
        amountCents: moneyCentsSchema,
        /** Data de pagamento desta parcela (padrão: vencimento). */
        paidOn: isoDateSchema,
      }),
    )
    .min(1)
    .max(60),
});

export const rebuildFinancingSchema = z
  .object({
    householdId: z.string().uuid(),
    financingId: z.string().uuid(),
    name: z.string().min(1).max(160),
    institution: z.string().max(160).optional(),
    principalCents: moneyCentsSchema,
    installmentCount: z.number().int().positive().max(600),
    installmentAmountCents: moneyCentsSchema.optional(),
    firstDueOn: isoDateSchema,
    annualRateBps: z.number().int().min(0).max(100_000).optional(),
    amortizationSystem: amortizationSystemSchema,
    category: financingCategorySchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amortizationSystem === 'fixed') {
      if (data.installmentAmountCents === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'Valor da parcela é obrigatório no modo fixo',
          path: ['installmentAmountCents'],
        });
      }
      return;
    }
    if (data.annualRateBps === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Taxa anual é obrigatória para Price/SAC',
        path: ['annualRateBps'],
      });
    }
  });

export const softDeleteFinancingSchema = z.object({
  householdId: z.string().uuid(),
  financingId: z.string().uuid(),
});

export const softDeleteTransactionSchema = z.object({
  householdId: z.string().uuid(),
  transactionId: z.string().uuid(),
});

export const notificationPrefsSchema = z.object({
  emailDueReminders: z.boolean(),
  windowsDays: z.array(z.number().int().min(0).max(30)).min(1).max(5),
  weeklySummary: z.boolean().optional(),
});

export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);

export const updatePreferencesSchema = notificationPrefsSchema.extend({
  ttsEnabled: z.boolean().optional(),
  theme: themePreferenceSchema,
  incomeDay: z.number().int().min(1).max(28).nullable().optional(),
  defaultCostCenterId: z.string().uuid().nullable().optional(),
  defaultAccountId: z.string().uuid().nullable().optional(),
});

export const importColumnMappingSchema = z.object({
  occurredOn: z.string().min(1),
  amount: z.string().min(1),
  type: z.string().optional(),
  settlement: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  costCenter: z.string().optional(),
  account: z.string().optional(),
});

export const importPreviewRowUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['ok', 'error', 'skip']),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  type: z.enum(['income', 'expense']),
  settlement: z.enum(['paid', 'pending']).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  costCenter: z.string().max(120).optional().nullable(),
  account: z.string().max(120).optional().nullable(),
  paymentMethod: z.string().max(120).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  reason: z.string().max(500).optional().nullable(),
});

export const updateImportPreviewSchema = z.object({
  jobId: z.string().uuid(),
  rows: z.array(importPreviewRowUpdateSchema).max(5000),
});

export const jarvisMessageSchema = z.object({
  threadId: z.string().uuid().optional(),
  content: z.string().min(1).max(4000),
  source: z.enum(['text', 'voice']).default('text'),
});

export const createHouseholdInviteSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(255),
  role: roleSchema,
});

export const acceptHouseholdInviteSchema = z.object({
  token: z.string().min(16).max(128),
});

export const revokeHouseholdInviteSchema = z.object({
  invitationId: z.string().uuid(),
});

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().uuid(),
  role: roleSchema,
});

export const removeMemberSchema = z.object({
  membershipId: z.string().uuid(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreatePendingTransactionInput = z.infer<typeof createPendingTransactionSchema>;
export type CreateMonthlySeriesInput = z.infer<typeof createMonthlySeriesSchema>;
export type UpdatePendingAmountInput = z.infer<typeof updatePendingAmountSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type PayTransactionInput = z.infer<typeof payTransactionSchema>;
export type PayTransactionsBulkInput = z.infer<typeof payTransactionsBulkSchema>;
export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type SetupBankInput = z.infer<typeof setupBankSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type UpdateAccountBalanceInput = z.infer<typeof updateAccountBalanceSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
export type PayCreditCardInvoiceInput = z.infer<typeof payCreditCardInvoiceSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type PaymentRail = z.infer<typeof paymentRailSchema>;
export type AccountKind = z.infer<typeof accountKindSchema>;
export type CreateFinancingInput = z.infer<typeof createFinancingSchema>;
export type PlanKind = z.infer<typeof planKindSchema>;
export type FinancingCategory = z.infer<typeof financingCategorySchema>;
export type PlanItemInput = z.infer<typeof planItemInputSchema>;
export type PlanContributionInput = z.infer<typeof planContributionInputSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type UpsertPlanItemsInput = z.infer<typeof upsertPlanItemsSchema>;
export type UpsertPlanContributionsInput = z.infer<typeof upsertPlanContributionsSchema>;
export type SoftDeletePlanInput = z.infer<typeof softDeletePlanSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;
export type PayInstallmentsBulkInput = z.infer<typeof payInstallmentsBulkSchema>;
export type RebuildFinancingInput = z.infer<typeof rebuildFinancingSchema>;
export type SoftDeleteFinancingInput = z.infer<typeof softDeleteFinancingSchema>;
export type SoftDeleteTransactionInput = z.infer<typeof softDeleteTransactionSchema>;
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export type ThemePreference = z.infer<typeof themePreferenceSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type ImportColumnMapping = z.infer<typeof importColumnMappingSchema>;
export type ImportPreviewRowUpdate = z.infer<typeof importPreviewRowUpdateSchema>;
export type UpdateImportPreviewInput = z.infer<typeof updateImportPreviewSchema>;
export type JarvisMessageInput = z.infer<typeof jarvisMessageSchema>;
export type CreateHouseholdInviteInput = z.infer<typeof createHouseholdInviteSchema>;
export type AcceptHouseholdInviteInput = z.infer<typeof acceptHouseholdInviteSchema>;
export type RevokeHouseholdInviteInput = z.infer<typeof revokeHouseholdInviteSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
