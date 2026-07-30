import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function shouldBypassAuth(): boolean {
  const demo = process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true';
  const mock =
    process.env.MOCK_API === '1' ||
    process.env.MOCK_API === 'true' ||
    process.env.NEXT_PUBLIC_MOCK_API === '1' ||
    process.env.NEXT_PUBLIC_MOCK_API === 'true';
  return demo || mock;
}

function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.startsWith('pk_') && !key.includes('placeholder'));
}

function shouldUseClerk(): boolean {
  if (shouldBypassAuth()) return false;
  return isClerkConfigured();
}

export default async function middleware(req: NextRequest) {
  if (!shouldUseClerk()) {
    return NextResponse.next();
  }

  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
  const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/invite(.*)',
    '/api/cron(.*)',
    '/api/v1(.*)',
    '/api/health',
    '/manifest.webmanifest',
    '/sw.js',
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
