'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
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

function fromIsoLocal(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
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

  const [draftFrom, setDraftFrom] = useState(resolved.start);
  const [draftTo, setDraftTo] = useState(resolved.end);
  const [fromMonth, setFromMonth] = useState<Date>(
    () => fromIsoLocal(resolved.start) ?? new Date(),
  );
  const [toMonth, setToMonth] = useState<Date>(() => fromIsoLocal(resolved.end) ?? new Date());

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const current = resolveDateRange({
        period: value.period,
        from: value.from,
        to: value.to,
      });
      setDraftFrom(current.start);
      setDraftTo(current.end);
      setFromMonth(fromIsoLocal(current.start) ?? new Date());
      setToMonth(fromIsoLocal(current.end) ?? new Date());
    }
  }

  function applyPreset(period: PeriodKey) {
    onChange({ period });
    setOpen(false);
  }

  function applyCustom() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(draftTo)) {
      return;
    }
    const from = draftFrom <= draftTo ? draftFrom : draftTo;
    const to = draftFrom <= draftTo ? draftTo : draftFrom;
    onChange({ period: 'custom', from, to });
    setOpen(false);
  }

  function setFrom(iso: string) {
    setDraftFrom(iso);
    const date = fromIsoLocal(iso);
    if (date) setFromMonth(date);
  }

  function setTo(iso: string) {
    setDraftTo(iso);
    const date = fromIsoLocal(iso);
    if (date) setToMonth(date);
  }

  const canApply = /^\d{4}-\d{2}-\d{2}$/.test(draftFrom) && /^\d{4}-\d{2}-\d{2}$/.test(draftTo);

  const fromDate = fromIsoLocal(draftFrom);
  const toDate = fromIsoLocal(draftTo);

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
          </div>

          <div className="grid gap-3 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Período personalizado — um calendário para cada data
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2 rounded-lg border bg-muted/20 p-2.5">
                <Label htmlFor="filter-period-from" className="text-sm font-semibold">
                  Início
                </Label>
                <DateInput id="filter-period-from" value={draftFrom} onValueChange={setFrom} />
                <Calendar
                  mode="single"
                  locale={ptBR}
                  captionLayout="dropdown"
                  startMonth={new Date(2020, 0)}
                  endMonth={new Date(new Date().getFullYear() + 2, 11)}
                  selected={fromDate}
                  month={fromMonth}
                  onMonthChange={setFromMonth}
                  onSelect={(date) => {
                    if (date) setFrom(toIsoLocal(date));
                  }}
                  className="mx-auto p-0"
                />
              </div>

              <div className="grid gap-2 rounded-lg border bg-muted/20 p-2.5">
                <Label htmlFor="filter-period-to" className="text-sm font-semibold">
                  Fim
                </Label>
                <DateInput id="filter-period-to" value={draftTo} onValueChange={setTo} />
                <Calendar
                  mode="single"
                  locale={ptBR}
                  captionLayout="dropdown"
                  startMonth={new Date(2020, 0)}
                  endMonth={new Date(new Date().getFullYear() + 2, 11)}
                  selected={toDate}
                  month={toMonth}
                  onMonthChange={setToMonth}
                  onSelect={(date) => {
                    if (date) setTo(toIsoLocal(date));
                  }}
                  className="mx-auto p-0"
                />
              </div>
            </div>

            <Button type="button" size="sm" disabled={!canApply} onClick={applyCustom}>
              Aplicar período
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
