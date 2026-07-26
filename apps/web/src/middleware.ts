import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isDemoMode(): boolean {
  return process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true';
}

function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith('pk_') && !key.includes('placeholder'));
}

export default async function middleware(req: NextRequest) {
  if (isDemoMode() || !isClerkConfigured()) {
    return NextResponse.next();
  }

  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
  const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/invite(.*)',
    '/api/cron(.*)',
    '/manifest.webmanifest',
    '/icons(.*)',
  ]);

  const handler = clerkMiddleware(async (auth, request) => {
    if (isPublicRoute(request)) {
      return NextResponse.next();
    }
    await auth.protect();
    return NextResponse.next();
  });

  return handler(req, {} as never);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
