import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { env } from '@/env';
import { getDb } from '@/server/db';

/**
 * Diagnóstico rápido de DB em produção.
 * GET /api/health/db
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL não configurada' }, { status: 500 });
  }

  try {
    const db = getDb();
    await db.execute(sql`select 1 as ok`);
    const tables = await db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name
    `);
    const rows: Array<{ table_name: string }> = Array.isArray(tables)
      ? tables
      : 'rows' in tables && Array.isArray(tables.rows)
        ? tables.rows
        : [];
    const names = rows.map((r: { table_name: string }) => r.table_name);
    const hasMemberships = names.includes('memberships');
    return NextResponse.json({
      ok: true,
      hasMemberships,
      tableCount: names.length,
      tables: names,
      hint: hasMemberships
        ? 'Schema ok — se /dashboard ainda falhar, veja logs da function.'
        : 'Schema vazio ou incompleto — rode: DATABASE_URL=<neon> pnpm db:migrate',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: 'Confira DATABASE_URL (use connection string pooled do Neon com sslmode=require) e rode as migrations.',
      },
      { status: 500 },
    );
  }
}
