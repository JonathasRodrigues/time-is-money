'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { resolveDateRange, type PeriodKey } from '@/lib/scope-query';

export interface FilterDateRangeValue {
  period: PeriodKey;
  from?: string;
  to?: string;
}

const PRESETS: Array<{ value: PeriodKey; label: string; group: 'past' | 'future' }> = [
  { value: 'this_month', label: 'Este mês', group: 'past' },
  { value: 'last_month', label: 'Mês passado', group: 'past' },
  { value: 'last_3m', label: 'Últimos 3 meses', group: 'past' },
  { value: 'last_6m', label: 'Últimos 6 meses', group: 'past' },
  { value: 'ytd', label: 'Este ano', group: 'past' },
  { value: 'last_year', label: 'Ano passado', group: 'past' },
  { value: 'next_month', label: 'Próximo mês', group: 'future' },
  { value: 'next_3m', label: 'Próximos 3 meses', group: 'future' },
  { value: 'next_6m', label: 'Próximos 6 meses', group: 'future' },
  { value: 'next_year', label: 'Próximo ano', group: 'future' },
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

function normalizeBounds(from: string, to: string): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from };
}

function capitalizePt(label: string): string {
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDayLabel(date: Date): string {
  return capitalizePt(format(date, 'dd MMM yyyy', { locale: ptBR }));
}

function labelForValue(value: FilterDateRangeValue): string {
  const resolved = resolveDateRange({
    period: value.period,
    from: value.from,
    to: value.to,
  });
  if (value.period === 'custom' && value.from && value.to) {
    const from = fromIsoLocal(value.from);
    const to = fromIsoLocal(value.to);
    if (from && to) {
      return `${formatDayLabel(from)} – ${formatDayLabel(to)}`;
    }
  }
  return resolved.label;
}

function draftLabel(range: DayPickerRange | undefined): string {
  if (!range?.from) return 'Selecione o início e o fim';
  if (!range.to) {
    return `${formatDayLabel(range.from)} – …`;
  }
  return `${formatDayLabel(range.from)} – ${formatDayLabel(range.to)}`;
}

/**
 * Filtro de período no padrão shadcn Date Picker:
 * Popover + Calendar `mode="range"` + presets laterais.
 * @see https://ui.shadcn.com/docs/components/date-picker
 */
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

  const [draft, setDraft] = useState<DayPickerRange | undefined>(() => ({
    from: fromIsoLocal(resolved.start),
    to: fromIsoLocal(resolved.end),
  }));
  const [month, setMonth] = useState<Date>(() => fromIsoLocal(resolved.start) ?? new Date());

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const current = resolveDateRange({
        period: value.period,
        from: value.from,
        to: value.to,
      });
      const from = fromIsoLocal(current.start);
      setDraft({
        from,
        to: fromIsoLocal(current.end),
      });
      setMonth(from ?? new Date());
    }
  }

  function applyPreset(period: PeriodKey) {
    onChange({ period });
    setOpen(false);
  }

  function applyCustom(range: DayPickerRange | undefined) {
    if (!range?.from || !range.to) return;
    const { from, to } = normalizeBounds(toIsoLocal(range.from), toIsoLocal(range.to));
    onChange({ period: 'custom', from, to });
    setOpen(false);
  }

  function handleRangeSelect(range: DayPickerRange | undefined) {
    setDraft(range);
  }

  const calendarStart = new Date(2018, 0);
  const calendarEnd = new Date(new Date().getFullYear() + 5, 11);
  const pastPresets = PRESETS.filter((preset) => preset.group === 'past');
  const futurePresets = PRESETS.filter((preset) => preset.group === 'future');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id="date-range"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 min-w-[12rem] justify-start gap-2 bg-background px-2.5 text-left font-normal tabular-nums',
            className,
          )}
          aria-label="Período"
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{labelForValue(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-1.5rem)] p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-row gap-1 overflow-x-auto border-b p-2 sm:w-44 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
            {pastPresets.map((preset) => (
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
            <Separator className="my-1 hidden sm:block" />
            {futurePresets.map((preset) => (
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

          <div className="relative isolate flex min-w-0 flex-col overflow-hidden">
            <Calendar
              mode="range"
              locale={ptBR}
              weekStartsOn={1}
              showOutsideDays={false}
              numberOfMonths={2}
              pagedNavigation={false}
              month={month}
              onMonthChange={setMonth}
              startMonth={calendarStart}
              endMonth={calendarEnd}
              selected={draft}
              onSelect={handleRangeSelect}
              formatters={{
                formatCaption: (date) => capitalizePt(format(date, 'MMMM yyyy', { locale: ptBR })),
                formatWeekdayName: (date) => format(date, 'EEEEEE', { locale: ptBR }),
              }}
              className="p-2 sm:p-3 [[data-slot=popover-content]_&]:bg-transparent"
              classNames={{
                months: 'relative flex flex-col gap-4 sm:flex-row',
                nav: 'absolute inset-x-0 top-0 z-10 flex items-center justify-between',
                button_previous: 'z-10',
                button_next: 'z-10',
                month_caption: 'relative flex h-(--cell-size) w-full items-center justify-center',
                range_start: 'rounded-l-md bg-primary/20',
                range_middle: 'rounded-none bg-primary/15',
                range_end: 'rounded-r-md bg-primary/20',
              }}
            />
            <Separator />
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <p className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">
                {draftLabel(draft)}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0"
                disabled={!draft?.from || !draft.to}
                onClick={() => applyCustom(draft)}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
