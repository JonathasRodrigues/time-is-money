'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import type { AppTheme } from '@/components/theme-provider';

/** Alinha next-themes com a preferência persistida no servidor (uma vez por valor). */
export function ThemeSync({ preference }: { preference: AppTheme | null | undefined }): null {
  const { setTheme } = useTheme();
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    if (!preference) return;
    if (lastSynced.current === preference) return;
    lastSynced.current = preference;
    setTheme(preference);
  }, [preference, setTheme]);

  return null;
}
