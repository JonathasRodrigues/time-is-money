'use client';

import { useEffect, useState, useTransition } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { updateThemePreferenceAction } from '@/server/actions';
import type { AppTheme } from '@/components/theme-provider';

const OPTIONS: Array<{ value: AppTheme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function ThemeToggle({
  className,
  persist = true,
}: {
  className?: string;
  /** Quando false, só altera localStorage (ex.: landing). */
  persist?: boolean;
}): React.ReactElement {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  function applyTheme(next: AppTheme): void {
    setTheme(next);
    if (!persist) return;
    startTransition(() => {
      void updateThemePreferenceAction(next);
    });
  }

  const current = (theme as AppTheme | undefined) ?? 'system';
  const TriggerIcon = !mounted ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('size-8', className)}
          aria-label="Alternar tema"
        >
          <TriggerIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => applyTheme(option.value)}
            className={cn(mounted && current === option.value && 'bg-accent')}
          >
            <option.icon className="size-4" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
