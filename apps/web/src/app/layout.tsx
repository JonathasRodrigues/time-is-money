import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import { IBM_Plex_Sans } from 'next/font/google';
import { RegisterServiceWorker } from '@/components/register-sw';
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
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Time is Money',
  },
};

export const viewport: Viewport = {
  themeColor: '#152033',
  width: 'device-width',
  initialScale: 1,
};

function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith('pk_') && !key.includes('placeholder'));
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  const configured = isClerkConfigured();
  const content = (
    <TooltipProvider>
      <RegisterServiceWorker />
      {children}
      <Toaster />
      <Analytics />
    </TooltipProvider>
  );

  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} font-sans antialiased`}>
        {configured ? (
          <ClerkProvider appearance={{ theme: shadcn }}>{content}</ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
