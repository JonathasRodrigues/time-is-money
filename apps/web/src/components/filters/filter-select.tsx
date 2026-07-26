'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface FilterSelectOption {
  value: string;
  label: string;
}

/** Select shadcn para filtros (valor controlado via URL). */
export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Selecionar',
  ariaLabel,
  className,
  triggerClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
}): React.ReactElement {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className={cn('h-8 min-w-[10.5rem] bg-background', triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={className}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
