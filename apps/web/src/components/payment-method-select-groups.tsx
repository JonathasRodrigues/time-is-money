'use client';

import {
  groupPaymentMethods,
  paymentMethodOptionLabelInGroup,
  type PaymentMethodOption,
} from '@/components/payment-method-options';

/**
 * Optgroups por conta/banco: meios na conta + cartões da mesma conta vinculada.
 */
export function PaymentMethodSelectGroups({
  accountMethods,
  cardMethods = [],
  showCards = false,
}: {
  accountMethods: PaymentMethodOption[];
  cardMethods?: PaymentMethodOption[];
  showCards?: boolean;
}): React.ReactElement {
  const methods = showCards ? [...accountMethods, ...cardMethods] : accountMethods;
  const groups = groupPaymentMethods(methods);

  return (
    <>
      {groups.map((group) => (
        <optgroup key={group.key} label={group.label}>
          {group.methods.map((method) => (
            <option key={method.id} value={method.id}>
              {paymentMethodOptionLabelInGroup(method)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
