'use client';

import {
  INSTANT_ACCOUNT_PAYMENT_RAILS,
  PAYMENT_RAIL_LABEL,
  type InstantAccountPaymentRail,
} from '@tim/domain';

const RAIL_HINT: Record<InstantAccountPaymentRail, string> = {
  pix: 'Transferência instantânea',
  debit: 'Débito na conta',
  ted: 'Transferência bancária',
  boleto: 'Pagamento de boleto',
};

export function AccountPaymentRailsFields({
  idPrefix,
  defaultRails,
}: {
  idPrefix: string;
  defaultRails: readonly InstantAccountPaymentRail[];
}): React.ReactElement {
  const selected = new Set(defaultRails);

  return (
    <fieldset className="grid gap-2 sm:col-span-2">
      <input type="hidden" name="allowedPaymentRailsConfigured" value="1" />
      <legend className="text-sm font-medium">Formas de pagamento</legend>
      <p className="text-xs text-muted-foreground">
        Desmarque todas se a conta for só para guardar saldo. Cartão de crédito continua no cadastro
        de cartões.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {INSTANT_ACCOUNT_PAYMENT_RAILS.map((rail) => {
          const inputId = `${idPrefix}-rail-${rail}`;
          return (
            <label
              key={rail}
              htmlFor={inputId}
              className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <input
                id={inputId}
                type="checkbox"
                name="allowedPaymentRails"
                value={rail}
                defaultChecked={selected.has(rail)}
                className="mt-0.5 size-4 rounded border"
              />
              <span>
                <span className="font-medium">{PAYMENT_RAIL_LABEL[rail]}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {RAIL_HINT[rail]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
