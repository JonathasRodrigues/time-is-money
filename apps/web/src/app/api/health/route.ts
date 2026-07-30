import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Same-origin health for Vercel (Hono `/health` when API runs standalone). */
export function GET(): NextResponse {
  return NextResponse.json({ ok: true, service: '@tim/api' });
}
