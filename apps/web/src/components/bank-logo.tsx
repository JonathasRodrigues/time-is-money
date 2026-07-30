'use client';

import { useState } from 'react';
import {
  brazilianBankIconUrl,
  findBrazilianBankById,
  findBrazilianBankByName,
  type BrazilianBankOption,
} from '@tim/domain';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'size-7 text-[10px]',
  md: 'size-10 text-xs',
  lg: 'size-12 text-sm',
};

const ICON_PX: Record<Size, number> = {
  sm: 18,
  md: 24,
  lg: 30,
};

function resolveBank(input: {
  catalogId?: string | null;
  name?: string | null;
}): BrazilianBankOption | undefined {
  if (input.catalogId) {
    const byId = findBrazilianBankById(input.catalogId);
    if (byId) return byId;
  }
  if (input.name) return findBrazilianBankByName(input.name);
  return undefined;
}

function monogramFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function isLightColor(hex: string): boolean {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return false;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.72;
}

export function BankLogo({
  catalogId,
  name,
  size = 'md',
  className,
}: {
  catalogId?: string | null;
  name?: string | null;
  size?: Size;
  className?: string;
}): React.ReactElement {
  const bank = resolveBank({ catalogId, name });
  const [iconFailed, setIconFailed] = useState(false);

  const label = bank?.name ?? name?.trim() ?? 'Banco';
  const color = bank?.brandColor ?? '#64748b';
  const monogram = bank?.monogram ?? monogramFor(label);
  const light = isLightColor(color);
  const iconUrl = bank && !iconFailed ? brazilianBankIconUrl(bank) : null;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-xs',
        SIZE_CLASS[size],
        className,
      )}
      style={
        iconUrl
          ? { backgroundColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }
          : {
              backgroundColor: color,
              borderColor: 'transparent',
              color: light ? '#0f172a' : '#ffffff',
            }
      }
      title={label}
      aria-hidden
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          width={ICON_PX[size]}
          height={ICON_PX[size]}
          className="size-[70%] object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setIconFailed(true)}
        />
      ) : bank ? (
        <span className="font-semibold tracking-tight">{monogram}</span>
      ) : (
        <Building2 className="size-[45%] opacity-90" />
      )}
    </span>
  );
}
