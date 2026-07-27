'use client';

import { useTheme } from 'next-themes';
import { dark, shadcn } from '@clerk/ui/themes';
import { ClerkProvider } from '@clerk/nextjs';

export function ClerkThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const appearance = {
    theme: resolvedTheme === 'dark' ? dark : shadcn,
  };

  return <ClerkProvider appearance={appearance}>{children}</ClerkProvider>;
}
