import {
  apiPaths,
  confirmIncomeItemBodySchema,
  createAccountBodySchema,
  createCategoryBodySchema,
  createCostCenterBodySchema,
  createCreditCardBodySchema,
  createFinancingBodySchema,
  createHouseholdBodySchema,
  createInstitutionBodySchema,
  setupBankBodySchema,
  createInviteBodySchema,
  createMonthlySeriesBodySchema,
  createPendingTransactionBodySchema,
  createPlanBodySchema,
  createTransactionBodySchema,
  createTransferBodySchema,
  exportTransactionsBodySchema,
  imexImportCommitPath,
  imexImportPreviewJobPath,
  jarvisMessageBodySchema,
  memberInvitePath,
  memberPath,
  memberRolePath,
  okWithHouseholdIdResponseSchema,
  okWithPlanIdResponseSchema,
  okWithRedirectResponseSchema,
  payCreditCardInvoiceBodySchema,
  payInstallmentBodySchema,
  payInstallmentsBulkBodySchema,
  payTransactionBodySchema,
  payTransactionsBulkBodySchema,
  rebuildFinancingBodySchema,
  updateAccountBalanceBodySchema,
  updateAccountBodySchema,
  updateCreditCardBodySchema,
  updateImportPreviewBodySchema,
  updateInstitutionBodySchema,
  updateMemberRoleBodySchema,
  updatePendingAmountBodySchema,
  updatePlanBodySchema,
  updatePreferencesBodySchema,
  updateThemeBodySchema,
  updateTransactionBodySchema,
  upsertPlanContributionsBodySchema,
  upsertPlanItemsBodySchema,
  acceptInviteBodySchema,
  acceptInviteByIdBodySchema,
  type AccountsResponse,
  type BootstrapResponse,
  type CategoriesResponse,
  type CommitImportResponse,
  type CostCentersResponse,
  type DashboardResponse,
  type EnsureInstancesBody,
  type EnsureInstancesResponse,
  type ExportTransactionsResponse,
  type FinancingsResponse,
  type ImportPreviewResponse,
  type IncomePromptResponse,
  type InviteMemberResponse,
  type JarvisMessageResponse,
  type MeResponse,
  type MembersResponse,
  type OkResponse,
  type OkWithIdResponse,
  type PaymentsResponse,
  type PlanningResponse,
  type PreferencesResponse,
  type TransactionsResponse,
  type WealthResponse,
} from '@tim/api-contract';
import { apiFetch, apiFetchForm } from '@/lib/api-fetch';
import { scopeSearchParams } from '@/lib/api/query-keys';
import type { z } from 'zod';

export type ScopeParams = Record<string, string | undefined>;

type CreateTransactionBody = z.infer<typeof createTransactionBodySchema>;
type CreatePendingTransactionBody = z.infer<typeof createPendingTransactionBodySchema>;
type CreateMonthlySeriesBody = z.infer<typeof createMonthlySeriesBodySchema>;
type UpdateTransactionBody = z.infer<typeof updateTransactionBodySchema>;
type UpdatePendingAmountBody = z.infer<typeof updatePendingAmountBodySchema>;
type PayTransactionBody = z.infer<typeof payTransactionBodySchema>;
type PayTransactionsBulkBody = z.infer<typeof payTransactionsBulkBodySchema>;
type CreateCostCenterBody = z.infer<typeof createCostCenterBodySchema>;
type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
type CreateInstitutionBody = z.infer<typeof createInstitutionBodySchema>;
type SetupBankBody = z.infer<typeof setupBankBodySchema>;
type UpdateInstitutionBody = z.infer<typeof updateInstitutionBodySchema>;
type CreateAccountBody = z.infer<typeof createAccountBodySchema>;
type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;
type UpdateAccountBalanceBody = z.infer<typeof updateAccountBalanceBodySchema>;
type CreateCreditCardBody = z.infer<typeof createCreditCardBodySchema>;
type UpdateCreditCardBody = z.infer<typeof updateCreditCardBodySchema>;
type PayCreditCardInvoiceBody = z.infer<typeof payCreditCardInvoiceBodySchema>;
type CreateTransferBody = z.infer<typeof createTransferBodySchema>;
type CreateFinancingBody = z.infer<typeof createFinancingBodySchema>;
type PayInstallmentBody = z.infer<typeof payInstallmentBodySchema>;
type PayInstallmentsBulkBody = z.infer<typeof payInstallmentsBulkBodySchema>;
type RebuildFinancingBody = z.infer<typeof rebuildFinancingBodySchema>;
type CreatePlanBody = z.infer<typeof createPlanBodySchema>;
type UpdatePlanBody = z.infer<typeof updatePlanBodySchema>;
type UpsertPlanItemsBody = z.infer<typeof upsertPlanItemsBodySchema>;
type UpsertPlanContributionsBody = z.infer<typeof upsertPlanContributionsBodySchema>;
type UpdatePreferencesBody = z.infer<typeof updatePreferencesBodySchema>;
type UpdateThemeBody = z.infer<typeof updateThemeBodySchema>;
type ConfirmIncomeItemBody = z.infer<typeof confirmIncomeItemBodySchema>;
type CreateHouseholdBody = z.infer<typeof createHouseholdBodySchema>;
type CreateInviteBody = z.infer<typeof createInviteBodySchema>;
type AcceptInviteBody = z.infer<typeof acceptInviteBodySchema>;
type AcceptInviteByIdBody = z.infer<typeof acceptInviteByIdBodySchema>;
type UpdateMemberRoleBody = z.infer<typeof updateMemberRoleBodySchema>;
type ExportTransactionsBody = z.infer<typeof exportTransactionsBodySchema>;
type UpdateImportPreviewBody = z.infer<typeof updateImportPreviewBodySchema>;
type JarvisMessageBody = z.infer<typeof jarvisMessageBodySchema>;
type OkWithHouseholdIdResponse = z.infer<typeof okWithHouseholdIdResponseSchema>;
type OkWithPlanIdResponse = z.infer<typeof okWithPlanIdResponseSchema>;
type OkWithRedirectResponse = z.infer<typeof okWithRedirectResponseSchema>;

export const api = {
  me: (): Promise<MeResponse> => apiFetch<MeResponse>(apiPaths.me),

  bootstrap: (): Promise<BootstrapResponse> => apiFetch<BootstrapResponse>(apiPaths.bootstrap),

  households: {
    create: (body: CreateHouseholdBody): Promise<OkWithHouseholdIdResponse> =>
      apiFetch<OkWithHouseholdIdResponse>(apiPaths.households, { method: 'POST', body }),
  },

  payments: {
    ensureInstances: (body: EnsureInstancesBody = {}): Promise<EnsureInstancesResponse> =>
      apiFetch<EnsureInstancesResponse>(apiPaths.paymentsEnsureInstances, {
        method: 'POST',
        body,
      }),
    list: (params: ScopeParams): Promise<PaymentsResponse> =>
      apiFetch<PaymentsResponse>(`${apiPaths.payments}${scopeSearchParams(params)}`),
  },

  dashboard: {
    get: (params: ScopeParams): Promise<DashboardResponse> =>
      apiFetch<DashboardResponse>(`${apiPaths.dashboard}${scopeSearchParams(params)}`),
  },

  transactions: {
    list: (params: ScopeParams): Promise<TransactionsResponse> =>
      apiFetch<TransactionsResponse>(`${apiPaths.transactions}${scopeSearchParams(params)}`),
    create: (body: CreateTransactionBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.transactions, { method: 'POST', body }),
    createPending: (body: CreatePendingTransactionBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.transactionsPending, { method: 'POST', body }),
    createMonthlySeries: (body: CreateMonthlySeriesBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.transactionsMonthlySeries, { method: 'POST', body }),
    update: (transactionId: string, body: UpdateTransactionBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.transactions}/${transactionId}`, {
        method: 'PATCH',
        body,
      }),
    delete: (transactionId: string): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.transactions}/${transactionId}`, { method: 'DELETE' }),
    pay: (transactionId: string, body: PayTransactionBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.transactions}/${transactionId}/pay`, {
        method: 'POST',
        body,
      }),
    payBulk: (body: PayTransactionsBulkBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.transactionsPayBulk, { method: 'POST', body }),
    updatePendingAmount: (
      transactionId: string,
      body: UpdatePendingAmountBody,
    ): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.transactions}/${transactionId}/pending-amount`, {
        method: 'PATCH',
        body,
      }),
  },

  wealth: {
    get: (): Promise<WealthResponse> => apiFetch<WealthResponse>(apiPaths.wealth),
  },

  financings: {
    list: (params: ScopeParams): Promise<FinancingsResponse> =>
      apiFetch<FinancingsResponse>(`${apiPaths.financings}${scopeSearchParams(params)}`),
    create: (body: CreateFinancingBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.financings, { method: 'POST', body }),
    payInstallment: (installmentId: string, body: PayInstallmentBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.financings}/installments/${installmentId}/pay`, {
        method: 'POST',
        body,
      }),
    payInstallmentsBulk: (body: PayInstallmentsBulkBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.financingsPayInstallmentsBulk, {
        method: 'POST',
        body,
      }),
    rebuild: (financingId: string, body: RebuildFinancingBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.financings}/${financingId}/rebuild`, {
        method: 'POST',
        body,
      }),
    delete: (financingId: string): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.financings}/${financingId}`, { method: 'DELETE' }),
  },

  planning: {
    list: (params: ScopeParams): Promise<PlanningResponse> =>
      apiFetch<PlanningResponse>(`${apiPaths.planning}${scopeSearchParams(params)}`),
    create: (body: CreatePlanBody): Promise<OkWithPlanIdResponse> =>
      apiFetch<OkWithPlanIdResponse>(apiPaths.plans, { method: 'POST', body }),
    update: (planId: string, body: UpdatePlanBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.plans}/${planId}`, { method: 'PATCH', body }),
    upsertItems: (planId: string, body: UpsertPlanItemsBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.plans}/${planId}/items`, { method: 'PUT', body }),
    upsertContributions: (planId: string, body: UpsertPlanContributionsBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.plans}/${planId}/contributions`, {
        method: 'PUT',
        body,
      }),
    delete: (planId: string): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.plans}/${planId}`, { method: 'DELETE' }),
  },

  accounts: {
    get: (): Promise<AccountsResponse> => apiFetch<AccountsResponse>(apiPaths.accounts),
    create: (body: CreateAccountBody): Promise<OkWithIdResponse> =>
      apiFetch<OkWithIdResponse>(apiPaths.accounts, { method: 'POST', body }),
    update: (accountId: string, body: UpdateAccountBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.accounts}/${accountId}`, { method: 'PATCH', body }),
    updateBalance: (accountId: string, body: UpdateAccountBalanceBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.accounts}/${accountId}/balance`, {
        method: 'PATCH',
        body,
      }),
  },

  institutions: {
    create: (body: CreateInstitutionBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.institutions, { method: 'POST', body }),
    setup: (body: SetupBankBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.institutionsSetup, { method: 'POST', body }),
    update: (institutionId: string, body: UpdateInstitutionBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.institutions}/${institutionId}`, {
        method: 'PATCH',
        body,
      }),
  },

  creditCards: {
    create: (body: CreateCreditCardBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.creditCards, { method: 'POST', body }),
    update: (creditCardId: string, body: UpdateCreditCardBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.creditCards}/${creditCardId}`, {
        method: 'PATCH',
        body,
      }),
    payInvoice: (creditCardId: string, body: PayCreditCardInvoiceBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(`${apiPaths.creditCards}/${creditCardId}/pay-invoice`, {
        method: 'POST',
        body,
      }),
  },

  transfers: {
    create: (body: CreateTransferBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.transfers, { method: 'POST', body }),
  },

  categories: {
    list: (): Promise<CategoriesResponse> => apiFetch<CategoriesResponse>(apiPaths.categories),
    create: (body: CreateCategoryBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.categories, { method: 'POST', body }),
  },

  costCenters: {
    list: (): Promise<CostCentersResponse> => apiFetch<CostCentersResponse>(apiPaths.costCenters),
    create: (body: CreateCostCenterBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.costCenters, { method: 'POST', body }),
  },

  preferences: {
    get: (): Promise<PreferencesResponse> => apiFetch<PreferencesResponse>(apiPaths.preferences),
    update: (body: UpdatePreferencesBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.preferences, { method: 'PATCH', body }),
    updateTheme: (body: UpdateThemeBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.preferencesTheme, { method: 'PATCH', body }),
  },

  incomePrompt: {
    get: (): Promise<IncomePromptResponse> => apiFetch<IncomePromptResponse>(apiPaths.incomePrompt),
    confirm: (): Promise<OkWithRedirectResponse> =>
      apiFetch<OkWithRedirectResponse>(apiPaths.incomePromptConfirm, { method: 'POST' }),
    confirmItem: (body: ConfirmIncomeItemBody): Promise<OkWithRedirectResponse> =>
      apiFetch<OkWithRedirectResponse>(apiPaths.incomePromptConfirmItem, {
        method: 'POST',
        body,
      }),
    snooze: (): Promise<OkResponse> =>
      apiFetch<OkResponse>(apiPaths.incomePromptSnooze, { method: 'POST' }),
  },

  members: {
    list: (): Promise<MembersResponse> => apiFetch<MembersResponse>(apiPaths.members),
    invite: (body: CreateInviteBody): Promise<InviteMemberResponse> =>
      apiFetch<InviteMemberResponse>(apiPaths.membersInvites, { method: 'POST', body }),
    revokeInvite: (invitationId: string): Promise<OkResponse> =>
      apiFetch<OkResponse>(memberInvitePath(invitationId), { method: 'DELETE' }),
    updateRole: (membershipId: string, body: UpdateMemberRoleBody): Promise<OkResponse> =>
      apiFetch<OkResponse>(memberRolePath(membershipId), { method: 'PATCH', body }),
    remove: (membershipId: string): Promise<OkResponse> =>
      apiFetch<OkResponse>(memberPath(membershipId), { method: 'DELETE' }),
  },

  invites: {
    accept: (body: AcceptInviteBody): Promise<OkWithRedirectResponse> =>
      apiFetch<OkWithRedirectResponse>(apiPaths.invitesAccept, { method: 'POST', body }),
    acceptById: (body: AcceptInviteByIdBody): Promise<OkWithRedirectResponse> =>
      apiFetch<OkWithRedirectResponse>(apiPaths.invitesAcceptById, { method: 'POST', body }),
  },

  imex: {
    template: (): Promise<{ csv: string }> => apiFetch<{ csv: string }>(apiPaths.imexTemplate),
    export: (body: ExportTransactionsBody): Promise<ExportTransactionsResponse> =>
      apiFetch<ExportTransactionsResponse>(apiPaths.imexExport, { method: 'POST', body }),
    previewImport: (formData: FormData): Promise<ImportPreviewResponse> =>
      apiFetchForm<ImportPreviewResponse>(apiPaths.imexImportPreview, formData),
    updateImportPreview: (
      jobId: string,
      body: UpdateImportPreviewBody,
    ): Promise<{ updated: number }> =>
      apiFetch<{ updated: number }>(imexImportPreviewJobPath(jobId), {
        method: 'PATCH',
        body,
      }),
    commitImport: (jobId: string): Promise<CommitImportResponse> =>
      apiFetch<CommitImportResponse>(imexImportCommitPath(jobId), { method: 'POST' }),
  },

  jarvis: {
    sendMessage: (body: JarvisMessageBody): Promise<JarvisMessageResponse> =>
      apiFetch<JarvisMessageResponse>(apiPaths.jarvisMessages, { method: 'POST', body }),
  },
} as const;
