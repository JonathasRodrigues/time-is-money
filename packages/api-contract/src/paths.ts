import { API_BASE_PATH } from './version';

export const apiPaths = {
  me: `${API_BASE_PATH}/me`,
  bootstrap: `${API_BASE_PATH}/bootstrap`,
  incomePrompt: `${API_BASE_PATH}/income-prompt`,
  dashboard: `${API_BASE_PATH}/dashboard`,
  payments: `${API_BASE_PATH}/payments`,
  paymentsEnsureInstances: `${API_BASE_PATH}/payments/ensure-instances`,
  transactions: `${API_BASE_PATH}/transactions`,
  wealth: `${API_BASE_PATH}/wealth`,
  financings: `${API_BASE_PATH}/financings`,
  planning: `${API_BASE_PATH}/planning`,
  accounts: `${API_BASE_PATH}/accounts`,
  categories: `${API_BASE_PATH}/categories`,
  costCenters: `${API_BASE_PATH}/cost-centers`,
  preferences: `${API_BASE_PATH}/preferences`,
  members: `${API_BASE_PATH}/members`,
  households: `${API_BASE_PATH}/households`,
  transactionsPayBulk: `${API_BASE_PATH}/transactions/pay-bulk`,
  transactionsPending: `${API_BASE_PATH}/transactions/pending`,
  transactionsMonthlySeries: `${API_BASE_PATH}/transactions/monthly-series`,
  transfers: `${API_BASE_PATH}/transfers`,
  institutions: `${API_BASE_PATH}/institutions`,
  institutionsSetup: `${API_BASE_PATH}/institutions/setup`,
  creditCards: `${API_BASE_PATH}/credit-cards`,
  financingsPayInstallmentsBulk: `${API_BASE_PATH}/financings/pay-installments-bulk`,
  plans: `${API_BASE_PATH}/plans`,
  incomePromptConfirm: `${API_BASE_PATH}/income-prompt/confirm`,
  incomePromptConfirmItem: `${API_BASE_PATH}/income-prompt/confirm-item`,
  incomePromptSnooze: `${API_BASE_PATH}/income-prompt/snooze`,
  preferencesTheme: `${API_BASE_PATH}/preferences/theme`,
  membersInvites: `${API_BASE_PATH}/members/invites`,
  invitesAccept: `${API_BASE_PATH}/invites/accept`,
  invitesAcceptById: `${API_BASE_PATH}/invites/accept-by-id`,
  imexTemplate: `${API_BASE_PATH}/imex/template`,
  imexExport: `${API_BASE_PATH}/imex/export`,
  imexImportPreview: `${API_BASE_PATH}/imex/import/preview`,
  jarvisMessages: `${API_BASE_PATH}/jarvis/messages`,
  openapi: `${API_BASE_PATH}/openapi.json`,
} as const;

export function memberInvitePath(invitationId: string): string {
  return `${API_BASE_PATH}/members/invites/${invitationId}`;
}

export function memberPath(membershipId: string): string {
  return `${API_BASE_PATH}/members/${membershipId}`;
}

export function memberRolePath(membershipId: string): string {
  return `${API_BASE_PATH}/members/${membershipId}/role`;
}

export function imexImportPreviewJobPath(jobId: string): string {
  return `${API_BASE_PATH}/imex/import/${jobId}/preview`;
}

export function imexImportCommitPath(jobId: string): string {
  return `${API_BASE_PATH}/imex/import/${jobId}/commit`;
}

export type ApiPath = (typeof apiPaths)[keyof typeof apiPaths];
