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
  /** Chamado com o texto BR (vírgula) a cada mudança — sem forçar `,00` enquanto digita. */
  onValueChange?: (brValue: string) => void;
};

/** Só para valor externo / blur — nunca durante digitação parcial. */
function formatExternalValue(raw: string | number | undefined): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'number') return formatCentsForBrInput(Math.round(raw * 100));
  const cents = parseBrlToCents(String(raw));
  if (cents != null) return formatCentsForBrInput(cents);
  return String(raw).replace('.', ',');
}

/**
 * Limpa caracteres inválidos, mas preserva digitação parcial (`190,`, `190,9`).
 * Não completa com `,00`.
 */
function sanitizeBrMoneyTyping(raw: string): string {
  const trimmed = raw.trim();
  const negative = trimmed.startsWith('-');
  let body = trimmed.replace(/[^\d.,]/g, '');

  // Ponto como decimal (teclado US) → vírgula, se ainda não houver vírgula
  if (!body.includes(',') && body.includes('.')) {
    const firstDot = body.indexOf('.');
    const before = body.slice(0, firstDot).replace(/\./g, '');
    const after = body.slice(firstDot + 1).replace(/\./g, '');
    body = after.length > 0 || body.endsWith('.') ? `${before},${after.slice(0, 2)}` : before;
  }

  const commaIdx = body.indexOf(',');
  if (commaIdx >= 0) {
    const whole = body.slice(0, commaIdx).replace(/[^\d]/g, '');
    const fraction = body
      .slice(commaIdx + 1)
      .replace(/[^\d]/g, '')
      .slice(0, 2);
    // Mantém a vírgula mesmo sem casas ainda (`190,`)
    body = `${whole},${fraction}`;
  } else {
    body = body.replace(/[^\d]/g, '');
  }

  return `${negative ? '-' : ''}${body}`;
}

/**
 * Campo monetário BR (vírgula decimal).
 * O `name` envia valor com ponto (`1234.56`) para parsers existentes.
 * Formata `,00` apenas no blur — enquanto digita, o texto fica livre.
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
  const [display, setDisplay] = React.useState(() => formatExternalValue(value ?? defaultValue));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isControlled || focused) return;
    setDisplay(formatExternalValue(value));
  }, [isControlled, value, focused]);

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
        onFocus={() => setFocused(true)}
        onChange={(event) => update(event.target.value)}
        onBlur={() => {
          setFocused(false);
          if (display === '') {
            onValueChange?.('');
            return;
          }
          if (cents == null) return;
          const formatted = formatCentsForBrInput(cents);
          setDisplay(formatted);
          onValueChange?.(formatted);
        }}
      />
    </>
  );
}
