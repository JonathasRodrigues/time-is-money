'use client';

import * as React from 'react';
import { formatCentsForBrInput, normalizeMoneyFormValue, parseBrlToCents } from '@tim/domain';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type MoneyInputProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'inputMode'
> & {
  /** Valor exibido (aceita `1234,56` ou `1234.56`). */
  value?: string;
  defaultValue?: string;
  /** Chamado com o texto BR (vírgula) a cada mudança. */
  onValueChange?: (brValue: string) => void;
};

function toBrDisplay(raw: string | number | undefined): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'number') return formatCentsForBrInput(Math.round(raw * 100));
  const asString = String(raw);
  const cents = parseBrlToCents(asString);
  if (cents != null) return formatCentsForBrInput(cents);
  // digitação parcial — só troca ponto decimal solto por vírgula
  if (/^\d+\.$/.test(asString)) return `${asString.slice(0, -1)},`;
  return asString.replace('.', ',');
}

function sanitizeBrMoneyTyping(raw: string): string {
  const negative = raw.trim().startsWith('-');
  let body = raw.replace(/[^\d.,]/g, '');
  // uma vírgula decimal; pontos só como milhar (opcional)
  const commaIdx = body.indexOf(',');
  if (commaIdx >= 0) {
    const whole = body.slice(0, commaIdx).replace(/,/g, '');
    const fraction = body
      .slice(commaIdx + 1)
      .replace(/[^\d]/g, '')
      .slice(0, 2);
    body = fraction.length > 0 || body.endsWith(',') ? `${whole},${fraction}` : whole;
  } else {
    body = body.replace(/,/g, '');
  }
  return `${negative ? '-' : ''}${body}`;
}

/**
 * Campo monetário BR (vírgula decimal).
 * O `name` envia valor com ponto (`1234.56`) para parsers existentes.
 */
export function MoneyInput({
  name,
  value,
  defaultValue,
  onValueChange,
  id,
  className,
  required,
  disabled,
  min,
  ...props
}: MoneyInputProps): React.ReactElement {
  const isControlled = value !== undefined;
  const [display, setDisplay] = React.useState(() => toBrDisplay(value ?? defaultValue));

  React.useEffect(() => {
    if (!isControlled) return;
    setDisplay(toBrDisplay(value));
  }, [isControlled, value]);

  const normalized = normalizeMoneyFormValue(display);
  const cents = parseBrlToCents(display);
  const minNumber = min === undefined || min === '' ? null : Number(min);
  const belowMin =
    minNumber != null && Number.isFinite(minNumber) && cents != null && cents / 100 < minNumber;

  function update(next: string) {
    const sanitized = sanitizeBrMoneyTyping(next);
    setDisplay(sanitized);
    onValueChange?.(sanitized);
  }

  return (
    <>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={normalized}
          required={required && normalized === ''}
        />
      ) : null}
      <Input
        {...props}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        disabled={disabled}
        required={name ? false : required}
        aria-required={required}
        aria-invalid={belowMin || props['aria-invalid'] ? true : undefined}
        className={cn('tabular-nums', className)}
        value={display}
        onChange={(event) => update(event.target.value)}
        onBlur={() => {
          if (display === '' || cents == null) return;
          const formatted = formatCentsForBrInput(cents);
          setDisplay(formatted);
          onValueChange?.(formatted);
        }}
      />
    </>
  );
}
