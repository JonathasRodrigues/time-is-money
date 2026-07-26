'use client';

import { useMemo, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { type DateRange } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatScopeDateBr, resolveDateRange, type PeriodKey } from '@/lib/scope-query';

export interface FilterDateRangeValue {
  period: PeriodKey;
  from?: string;
  to?: string;
}

const PRESETS: Array<{ value: PeriodKey; label: string }> = [
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'last_3m', label: 'Últimos 3 meses' },
  { value: 'last_6m', label: 'Últimos 6 meses' },
  { value: 'ytd', label: 'Este ano' },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function monthBoundsLocal(year: number, monthIndex: number): { from: string; to: string } {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { from: toIsoLocal(start), to: toIsoLocal(end) };
}

function labelForValue(value: FilterDateRangeValue): string {
  const resolved = resolveDateRange({
    period: value.period,
    from: value.from,
    to: value.to,
  });
  if (value.period === 'custom' && value.from && value.to) {
    return `${formatScopeDateBr(value.from)} – ${formatScopeDateBr(value.to)}`;
  }
  return resolved.label;
}

export function FilterDateRangePicker({
  value,
  onChange,
  className,
}: {
  value: FilterDateRangeValue;
  onChange: (next: FilterDateRangeValue) => void;
  className?: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const resolved = resolveDateRange({
    period: value.period,
    from: value.from,
    to: value.to,
  });

  const selected = useMemo<DateRange | undefined>(
    () => ({
      from: fromIsoLocal(resolved.start),
      to: fromIsoLocal(resolved.end),
    }),
    [resolved.start, resolved.end],
  );

  const [draft, setDraft] = useState<DateRange | undefined>(selected);
  const [month, setMonth] = useState<Date>(selected?.from ?? new Date());

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDraft(selected);
      setMonth(selected?.from ?? new Date());
    }
  }

  function applyPreset(period: PeriodKey) {
    onChange({ period });
    setOpen(false);
  }

  function applyCustomRange(range: DateRange | undefined) {
    if (!range?.from || !range.to) return;
    onChange({
      period: 'custom',
      from: toIsoLocal(range.from),
      to: toIsoLocal(range.to),
    });
    setOpen(false);
  }

  function applyVisibleMonth() {
    const bounds = monthBoundsLocal(month.getFullYear(), month.getMonth());
    onChange({ period: 'custom', from: bounds.from, to: bounds.to });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 justify-start gap-2 bg-background px-2.5 font-normal tabular-nums',
            className,
          )}
          aria-label="Período"
        >
          <CalendarIcon className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="truncate">{labelForValue(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-row gap-1 overflow-x-auto border-b p-2 sm:w-40 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
            {PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={value.period === preset.value ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 shrink-0 justify-start px-2.5 text-xs sm:w-full"
                onClick={() => applyPreset(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 justify-start px-2.5 text-xs sm:w-full"
              onClick={applyVisibleMonth}
            >
              Mês no calendário
            </Button>
          </div>

          <div className="p-2 sm:p-3">
            <Calendar
              mode="range"
              locale={ptBR}
              numberOfMonths={1}
              captionLayout="dropdown"
              startMonth={new Date(2020, 0)}
              endMonth={new Date(new Date().getFullYear() + 2, 11)}
              month={month}
              onMonthChange={setMonth}
              selected={draft}
              onSelect={(range) => {
                setDraft(range);
                if (range?.from && range.to) {
                  applyCustomRange(range);
                }
              }}
              defaultMonth={selected?.from}
            />
            <p className="mt-1 px-1 text-[11px] text-muted-foreground">
              Escolha início e fim, ou use mês/ano no topo do calendário.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
