'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  { value: '#155e4f', label: 'Teal' },
  { value: '#2f5d8a', label: 'Azul' },
  { value: '#152033', label: 'Ink' },
  { value: '#5f7a6a', label: 'Musgo' },
  { value: '#b7791f', label: 'Âmbar' },
  { value: '#a65d4d', label: 'Terracota' },
  { value: '#6b5b95', label: 'Uva' },
  { value: '#4a6fa5', label: 'Jeans' },
] as const;

function normalizeHex(raw: string): string {
  const value = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(value)) return `#${value.toLowerCase()}`;
  return '#155e4f';
}

export function CostCenterColorField({
  name = 'color',
  defaultValue = '#155e4f',
  id = 'color',
}: {
  name?: string;
  defaultValue?: string;
  id?: string;
}): React.ReactElement {
  const [color, setColor] = useState(() => normalizeHex(defaultValue));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Cor</Label>
      <input type="hidden" name={name} value={color} />
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_COLORS.map((preset) => {
          const selected = color.toLowerCase() === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              title={preset.label}
              aria-label={preset.label}
              aria-pressed={selected}
              onClick={() => setColor(preset.value)}
              className={cn(
                'size-8 rounded-full border-2 shadow-xs transition-transform',
                selected
                  ? 'scale-110 border-foreground ring-2 ring-ring/40'
                  : 'border-background hover:scale-105',
              )}
              style={{ backgroundColor: preset.value }}
            />
          );
        })}
        <label
          htmlFor={id}
          className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-input bg-muted/40"
          title="Cor personalizada"
        >
          <span
            className="absolute inset-1 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <input
            id={id}
            type="color"
            value={color}
            onChange={(event) => setColor(normalizeHex(event.target.value))}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Escolher cor personalizada"
          />
        </label>
      </div>
    </div>
  );
}

export function CostCenterColorSwatch({
  color,
}: {
  color: string | null | undefined;
}): React.ReactElement {
  if (!color) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="size-4 shrink-0 rounded-full border border-border shadow-xs"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="sr-only">{color}</span>
    </span>
  );
}
