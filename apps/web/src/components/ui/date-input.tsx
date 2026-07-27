'use client';

import * as React from 'react';
import { formatIsoDateBr, maskBrDateInput, parseBrDateToIso } from '@tim/domain';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type DateInputProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'defaultValue' | 'onChange'
> & {
  /** Valor em ISO `YYYY-MM-DD`. */
  value?: string;
  /** Valor inicial em ISO `YYYY-MM-DD`. */
  defaultValue?: string;
  /** Chamado com ISO quando a data completa é válida; `''` se limpo. */
  onValueChange?: (isoDate: string) => void;
};

function toDisplay(iso: string | undefined): string {
  if (!iso) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? formatIsoDateBr(iso) : iso;
}

/**
 * Campo de data no padrão BR (`dd/mm/yyyy`).
 * O `name` envia ISO `YYYY-MM-DD` (hidden) para o formulário.
 */
export function DateInput({
  name,
  value,
  defaultValue,
  onValueChange,
  id,
  className,
  required,
  disabled,
  ...props
}: DateInputProps): React.ReactElement {
  const isControlled = value !== undefined;
  const [display, setDisplay] = React.useState(() => toDisplay(value ?? defaultValue));
  const [iso, setIso] = React.useState(() => {
    const initial = value ?? defaultValue ?? '';
    return /^\d{4}-\d{2}-\d{2}$/.test(initial) ? initial : (parseBrDateToIso(initial) ?? '');
  });

  React.useEffect(() => {
    if (!isControlled) return;
    setDisplay(toDisplay(value));
    setIso(value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '');
  }, [isControlled, value]);

  function commitDisplay(nextDisplay: string) {
    setDisplay(nextDisplay);
    if (nextDisplay === '') {
      setIso('');
      onValueChange?.('');
      return;
    }
    const parsed = parseBrDateToIso(nextDisplay);
    if (parsed) {
      setIso(parsed);
      onValueChange?.(parsed);
      return;
    }
    // Parcial ou inválida: não envia ISO antigo no submit.
    setIso('');
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={iso} required={required && !iso} /> : null}
      <Input
        {...props}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        disabled={disabled}
        required={name ? false : required}
        aria-required={required}
        className={cn('tabular-nums', className)}
        value={display}
        onChange={(event) => {
          commitDisplay(maskBrDateInput(event.target.value));
        }}
        onBlur={() => {
          if (display === '') return;
          const parsed = parseBrDateToIso(display);
          if (parsed) {
            setDisplay(formatIsoDateBr(parsed));
            setIso(parsed);
            onValueChange?.(parsed);
          }
        }}
      />
    </>
  );
}
