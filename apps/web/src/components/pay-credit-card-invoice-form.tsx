'use client';

import {
  formatCentsForBrInput,
  INSTANT_ACCOUNT_PAYMENT_RAILS,
  PAYMENT_RAIL_LABEL,
  type InstantAccountPaymentRail,
  type PaymentRail,
} from '@tim/domain';
import { useMemo, useState } from 'react';
import { ActionForm } from '@/components/action-form';
import { nativeSelectClassName } from '@/components/page-header';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { payCreditCardInvoiceAction } from '@/lib/api/mutations';

/**
 * Pagamento de fatura: escolhe forma (meio) vinculada a uma conta —
 * o banco/conta é o vínculo da forma, não o “alvo” do pagamento.
 */
export function PayCreditCardInvoiceForm({
  creditCardId,
  invoiceBalanceCents,
  defaultPaymentAccountId,
  paymentAccounts,
  defaultPaidOn,
}: {
  creditCardId: string;
  invoiceBalanceCents: number;
  defaultPaymentAccountId: string;
  paymentAccounts: Array<{
    id: string;
    name: string;
    allowedPaymentRails?: readonly InstantAccountPaymentRail[];
  }>;
  defaultPaidOn: string;
}): React.ReactElement {
  const [accountId, setAccountId] = useState(defaultPaymentAccountId);
  const selected = paymentAccounts.find((account) => account.id === accountId);
  const rails = useMemo((): PaymentRail[] => {
    const allowed = selected?.allowedPaymentRails ?? [];
    return INSTANT_ACCOUNT_PAYMENT_RAILS.filter((rail) => allowed.includes(rail));
  }, [selected?.allowedPaymentRails]);
  const defaultRail = rails.includes('pix') ? 'pix' : (rails[0] ?? 'pix');

  return (
    <ActionForm
      action={payCreditCardInvoiceAction}
      successMessage="Fatura paga"
      loadingMessage="Pagando fatura…"
      invalidate={['money', 'settings']}
      className="grid gap-3 sm:grid-cols-2"
    >
      <input type="hidden" name="creditCardId" value={creditCardId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`pay-amount-${creditCardId}`}>Valor (R$)</Label>
        <MoneyInput
          id={`pay-amount-${creditCardId}`}
          name="amount"
          min="0.01"
          required
          defaultValue={formatCentsForBrInput(invoiceBalanceCents)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`pay-on-${creditCardId}`}>Data</Label>
        <DateInput
          id={`pay-on-${creditCardId}`}
          name="paidOn"
          required
          defaultValue={defaultPaidOn}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`pay-acc-${creditCardId}`}>Conta vinculada</Label>
        <select
          id={`pay-acc-${creditCardId}`}
          name="paymentAccountId"
          className={nativeSelectClassName}
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {paymentAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`pay-rail-${creditCardId}`}>Forma de pagamento</Label>
        <select
          id={`pay-rail-${creditCardId}`}
          name="paymentRail"
          className={nativeSelectClassName}
          key={`${accountId}:${defaultRail}`}
          defaultValue={defaultRail}
          disabled={rails.length === 0}
        >
          {rails.length === 0 ? (
            <option value="">Nenhuma forma nesta conta</option>
          ) : (
            rails.map((rail) => (
              <option key={rail} value={rail}>
                {PAYMENT_RAIL_LABEL[rail]}
              </option>
            ))
          )}
        </select>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Quitação da fatura ≠ compra no cartão. Aqui você escolhe como paga a fatura (PIX/débito/TED)
        na conta vinculada — o saldo dessa conta sai agora. Só aparecem as formas configuradas na
        conta.
      </p>
      <SubmitButton className="sm:col-span-2" pendingLabel="Pagando…" disabled={rails.length === 0}>
        Quitar fatura (sai da conta)
      </SubmitButton>
    </ActionForm>
  );
}
