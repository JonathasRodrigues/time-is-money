'use client';

import Link from 'next/link';
import { formatBrlFromCents } from '@tim/domain';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Leva para A pagar já filtrado neste cartão (em vez de modal). */
export function PayCreditCardInvoiceLink({
  creditCardId,
  invoiceBalanceCents,
  className,
}: {
  creditCardId: string;
  invoiceBalanceCents: number;
  className?: string;
}): React.ReactElement {
  if (invoiceBalanceCents <= 0) {
    return <span className={cn('text-xs text-muted-foreground', className)}>Fatura zerada</span>;
  }

  const href = `/payments?card=${encodeURIComponent(creditCardId)}`;

  return (
    <Button type="button" size="sm" variant="secondary" className={className} asChild>
      <Link href={href}>Pagar fatura · {formatBrlFromCents(invoiceBalanceCents)}</Link>
    </Button>
  );
}
