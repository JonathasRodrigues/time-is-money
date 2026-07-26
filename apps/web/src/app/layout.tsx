import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import { IBM_Plex_Sans } from 'next/font/google';
import { RegisterServiceWorker } from '@/components/register-sw';
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
