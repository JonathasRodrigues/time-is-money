'use client';

import {
  accountHasSufficientBalance,
  formatBrlFromCents,
  PAYMENT_RAIL_LABEL,
  type PayableKind,
  type PaymentRail,
} from '@tim/domain';

export interface PayableRow {
  id: string;
  dueOn: string | null;
  description: string | null;
  kind: PayableKind;
  costCenterId?: string | null;
  costCenterName: string;
  categoryId?: string | null;
  categoryName: string;
  accountId: string;
  amountCents: number | null;
  /** Meio previsto na quitação, quando cadastrado. */
  paymentRail?: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null;
  /** Forma persistida (FK). Preferir este campo. */
  paymentMethodId?: string | null;
  suggestedCents: number | null;
  estimatedCents: number;
  creditCardId?: string | null;
  creditCardInvoiceId?: string | null;
  creditCardName?: string | null;
  purchaseCount?: number | null;
}

export interface PaymentAccountOption {
  id: string;
  name: string;
}

export interface PaymentMethodOption {
  id: string;
  type: 'account' | 'credit_card';
  accountId: string | null;
  creditCardId: string | null;
  paymentRail: 'pix' | 'debit' | 'ted' | 'boleto' | 'cash' | 'other' | null;
  linkedAccountName?: string | null;
  linkedInstitutionName?: string | null;
  /** Saldo da conta; no cartão = limite disponível. */
  balanceCents?: number | null;
  label: string;
}

export interface PaymentMethodGroup {
  key: string;
  /** Ex.: "Nubank PF · Nubank" — rótulo do optgroup. */
  label: string;
  methods: PaymentMethodOption[];
}

/** Rótulo completo (lista / legado). */
export function paymentMethodSelectLabel(method: PaymentMethodOption): string {
  if (method.balanceCents == null) return method.label;
  if (method.type === 'credit_card') {
    return `${method.label} · disponível ${formatBrlFromCents(method.balanceCents)}`;
  }
  return `${method.label} · saldo ${formatBrlFromCents(method.balanceCents)}`;
}

/** Dentro do optgroup: meio (PIX…) ou cartão (+ limite disponível). */
export function paymentMethodOptionLabelInGroup(method: PaymentMethodOption): string {
  if (method.type === 'credit_card') {
    const institution = method.linkedInstitutionName?.trim();
    let label = method.label;
    if (institution && label.endsWith(` · ${institution}`)) {
      label = label.slice(0, -(institution.length + 3));
    }
    if (method.balanceCents == null) return label;
    return `${label} · disponível ${formatBrlFromCents(method.balanceCents)}`;
  }
  const rail = method.paymentRail;
  const railLabel =
    rail && rail in PAYMENT_RAIL_LABEL
      ? PAYMENT_RAIL_LABEL[rail as PaymentRail]
      : method.label.split('·')[0]?.trim() || method.label;
  if (method.balanceCents == null) return railLabel;
  return `${railLabel} · saldo ${formatBrlFromCents(method.balanceCents)}`;
}

/** @deprecated Preferir paymentMethodOptionLabelInGroup. */
export function paymentRailOptionLabel(method: PaymentMethodOption): string {
  return paymentMethodOptionLabelInGroup(method);
}

function methodGroupLabel(method: PaymentMethodOption): string {
  if (method.type === 'credit_card') {
    const institution = method.linkedInstitutionName?.trim();
    const account = method.linkedAccountName?.trim();
    if (account && institution) return `${account} · ${institution}`;
    if (institution) return institution;
    if (account) return account;
    return 'Cartão de crédito';
  }
  const name = method.linkedAccountName?.trim();
  const institution = method.linkedInstitutionName?.trim();
  if (name && institution) return `${name} · ${institution}`;
  if (name) return name;
  const parts = method.label
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts.slice(1).join(' · ');
  return method.label;
}

function methodGroupKey(method: PaymentMethodOption): string {
  if (method.type === 'account' && method.accountId) {
    return `account:${method.accountId}`;
  }
  if (method.type === 'credit_card') {
    if (method.accountId) return `account:${method.accountId}`;
    const institution = method.linkedInstitutionName?.trim();
    if (institution) return `institution:${institution}`;
    if (method.creditCardId) return `card:${method.creditCardId}`;
  }
  return method.id;
}

/**
 * Agrupa formas por conta/banco: PIX/débito/TED/boleto e cartões
 * da mesma conta vinculada no mesmo optgroup.
 */
export function groupPaymentMethods(methods: PaymentMethodOption[]): PaymentMethodGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, PaymentMethodGroup>();

  for (const method of methods) {
    const key = methodGroupKey(method);
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        label: methodGroupLabel(method),
        methods: [],
      };
      byKey.set(key, group);
      order.push(key);
    }
    group.methods.push(method);
  }

  // Conta primeiro (rails), cartão depois dentro do grupo.
  for (const group of byKey.values()) {
    group.methods.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'account' ? -1 : 1;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
  }

  return order.map((key) => byKey.get(key)!);
}

/** @deprecated Preferir groupPaymentMethods. */
export function groupAccountPaymentMethods(methods: PaymentMethodOption[]): PaymentMethodGroup[] {
  return groupPaymentMethods(methods.filter((method) => method.type === 'account'));
}

/** Conta a receber: só o nome da conta (sem PIX/débito/TED). */
export function receiveAccountSelectLabel(method: PaymentMethodOption): string {
  return method.linkedAccountName?.trim() || method.label;
}

/** Uma opção por conta; PIX só como rail padrão na API. */
export function uniqueAccountMethods(methods: PaymentMethodOption[]): PaymentMethodOption[] {
  const byAccount = new Map<string, PaymentMethodOption>();
  for (const method of methods) {
    if (method.type !== 'account' || !method.accountId) continue;
    const existing = byAccount.get(method.accountId);
    if (!existing || method.paymentRail === 'pix') {
      byAccount.set(method.accountId, {
        ...method,
        paymentRail:
          method.paymentRail === 'pix' || !existing
            ? (method.paymentRail ?? 'pix')
            : existing.paymentRail,
        label: method.linkedAccountName?.trim() || method.label,
      });
    }
  }
  return [...byAccount.values()];
}

/** Conta/cartão sem saldo ou limite disponível para o valor (não aplica a receber). */
export function methodLacksBalance(
  method: PaymentMethodOption | undefined,
  amountCents: number | null,
  opts?: { isReceive?: boolean },
): boolean {
  if (opts?.isReceive) return false;
  if (!method) return false;
  if (amountCents == null || amountCents <= 0) return false;
  if (method.balanceCents == null) return false;
  if (method.type === 'credit_card') {
    return amountCents > method.balanceCents;
  }
  if (method.type !== 'account') return false;
  return !accountHasSufficientBalance({
    amountCents,
    accountBalanceCents: method.balanceCents,
  });
}

export function defaultPaymentMethodId(
  row: Pick<PayableRow, 'accountId' | 'paymentRail' | 'paymentMethodId' | 'kind'>,
  methods: PaymentMethodOption[],
): string {
  const pool =
    row.kind === 'credit_card_invoice'
      ? methods.filter((method) => method.type === 'account')
      : methods;
  if (row.paymentMethodId) {
    const byId = pool.find((method) => method.id === row.paymentMethodId);
    if (byId) return byId.id;
  }
  if (row.paymentRail) {
    const byAccountRail = pool.find(
      (method) =>
        method.type === 'account' &&
        method.accountId === row.accountId &&
        method.paymentRail === row.paymentRail,
    );
    if (byAccountRail) return byAccountRail.id;
  }
  const byAccountPix = pool.find(
    (method) =>
      method.type === 'account' &&
      method.accountId === row.accountId &&
      method.paymentRail === 'pix',
  );
  if (byAccountPix) return byAccountPix.id;
  const byAccount = pool.find(
    (method) => method.type === 'account' && method.accountId === row.accountId,
  );
  return byAccount?.id ?? pool[0]?.id ?? '';
}

export function payAmountCents(
  row: Pick<PayableRow, 'amountCents' | 'suggestedCents'>,
): number | null {
  if (row.amountCents != null && row.amountCents > 0) return row.amountCents;
  if (row.suggestedCents != null && row.suggestedCents > 0) return row.suggestedCents;
  return null;
}
