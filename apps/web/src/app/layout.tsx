import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { IBM_Plex_Sans } from 'next/font/google';
import { shouldUseClerk } from '@/components/auth-shell';
import { QueryProvider } from '@/components/query-provider';
import { RegisterServiceWorker } from '@/components/register-sw';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex',
});

export const metadata: Metadata = {
  title: 'Time is Money',
  description: 'Finanças domésticas compartilhadas, seguras e com insights.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Minhas Contas',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#141414' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const useClerk = shouldUseClerk();

  const inner = (
    <QueryProvider>
      <TooltipProvider>
        <RegisterServiceWorker />
        {children}
        <Toaster />
        <Analytics />
      </TooltipProvider>
    </QueryProvider>
  );

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${sans.variable} font-sans antialiased`}>
        <ThemeProvider>{useClerk ? <ClerkShell>{inner}</ClerkShell> : inner}</ThemeProvider>
      </body>
    </html>
  );
}

async function ClerkShell({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const { ClerkThemeProvider } = await import('@/components/clerk-theme-provider');
  return <ClerkThemeProvider>{children}</ClerkThemeProvider>;
}
