'use client';

import { formatCentsForBrInput, PAYMENT_RAIL_LABEL, type PaymentRail } from '@tim/domain';
import { ActionForm } from '@/components/action-form';
import { nativeSelectClassName } from '@/components/page-header';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { payCreditCardInvoiceAction } from '@/lib/api/mutations';

const INVOICE_PAYMENT_RAILS: PaymentRail[] = ['pix', 'debit', 'ted', 'boleto'];

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
  paymentAccounts: Array<{ id: string; name: string }>;
  defaultPaidOn: string;
}): React.ReactElement {
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
        <Label htmlFor={`pay-rail-${creditCardId}`}>Forma de pagamento</Label>
        <select
          id={`pay-rail-${creditCardId}`}
          name="paymentRail"
          className={nativeSelectClassName}
          defaultValue="pix"
        >
          {INVOICE_PAYMENT_RAILS.map((rail) => (
            <option key={rail} value={rail}>
              {PAYMENT_RAIL_LABEL[rail]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`pay-acc-${creditCardId}`}>Conta vinculada</Label>
        <select
          id={`pay-acc-${creditCardId}`}
          name="paymentAccountId"
          className={nativeSelectClassName}
          defaultValue={defaultPaymentAccountId}
        >
          {paymentAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Quitação da fatura ≠ compra no cartão. Aqui você escolhe como paga a fatura (PIX/débito/TED)
        na conta vinculada — o saldo dessa conta sai agora.
      </p>
      <SubmitButton className="sm:col-span-2" pendingLabel="Pagando…">
        Quitar fatura (sai da conta)
      </SubmitButton>
    </ActionForm>
  );
}
