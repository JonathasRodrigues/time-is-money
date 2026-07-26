'use server';

import { createTransaction } from '@tim/application';
import { requireCapability, requireSession } from '@tim/auth';
import {
  accounts,
  categories,
  costCenters,
  exportJobs,
  importJobRows,
  importJobs,
  transactions,
} from '@tim/db';
import {
  autoMapColumns,
  buildExportCsv,
  buildExportXlsx,
  buildTemplateCsv,
  mapRows,
  parseSpreadsheet,
} from '@tim/imex';
import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { createAppContext } from '@/server/context';
import { getDb } from '@/server/db';

export async function downloadTemplateAction(): Promise<{ csv: string }> {
  const session = requireSession((await createAppContext()).session);
  requireCapability(session, 'export.read');
  return { csv: buildTemplateCsv() };
}

export async function exportTransactionsAction(input: {
  format: 'csv' | 'xlsx';
  from?: string;
  to?: string;
}): Promise<{ base64: string; filename: string; format: 'csv' | 'xlsx' }> {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  requireCapability(session, 'export.read');
  const db = getDb();

  const filters = [
    eq(transactions.householdId, session.householdId),
    isNull(transactions.deletedAt),
    eq(transactions.status, 'paid'),
  ];
  if (input.from) filters.push(gte(transactions.occurredOn, input.from));
  if (input.to) filters.push(lte(transactions.occurredOn, input.to));

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...filters));

  const [cats, centers, accs] = await Promise.all([
    db.select().from(categories).where(eq(categories.householdId, session.householdId)),
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
  ]);
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const accMap = new Map(accs.map((a) => [a.id, a.name]));

  const exportRows = rows.flatMap((row) => {
    if (row.amountCents == null) return [];
    return [
      {
        occurredOn: row.occurredOn,
        amountCents: row.amountCents,
        type: row.type,
        description: row.description,
        category: catMap.get(row.categoryId) ?? null,
        costCenter: centerMap.get(row.costCenterId) ?? null,
        account: accMap.get(row.accountId) ?? null,
      },
    ];
  });

  await db.insert(exportJobs).values({
    householdId: session.householdId,
    userId: session.userId,
    format: input.format,
    filters: { from: input.from, to: input.to },
  });

  if (input.format === 'csv') {
    const csv = buildExportCsv(exportRows);
    return {
      base64: Buffer.from(csv, 'utf8').toString('base64'),
      filename: 'lancamentos.csv',
      format: 'csv',
    };
  }

  const xlsx = buildExportXlsx(exportRows);
  return {
    base64: Buffer.from(xlsx).toString('base64'),
    filename: 'lancamentos.xlsx',
    format: 'xlsx',
  };
}

export async function previewImportAction(formData: FormData): Promise<{
  jobId: string;
  ok: number;
  error: number;
  sample: Array<{ rowNumber: number; status: string; reason?: string }>;
}> {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  requireCapability(session, 'import.write');
  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new Error('Arquivo obrigatório');
  }

  const name = file.name.toLowerCase();
  const format = name.endsWith('.xlsx') ? 'xlsx' : 'csv';
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseSpreadsheet(buffer, format);
  const mapping = autoMapColumns(parsed.headers);
  const results = mapRows(parsed.rows, mapping);

  const db = getDb();
  const [job] = await db
    .insert(importJobs)
    .values({
      householdId: session.householdId,
      userId: session.userId,
      status: 'preview',
      fileName: file.name,
      format,
      mapping,
    })
    .returning();

  if (!job) throw new Error('Falha ao criar job');

  if (results.length > 0) {
    await db.insert(importJobRows).values(
      results.map((row) => ({
        jobId: job.id,
        rowNumber: row.rowNumber,
        status: row.status,
        payload: row.data ?? {},
        reason: row.reason,
      })),
    );
  }

  return {
    jobId: job.id,
    ok: results.filter((r) => r.status === 'ok').length,
    error: results.filter((r) => r.status === 'error').length,
    sample: results.slice(0, 20).map((r) => ({
      rowNumber: r.rowNumber,
      status: r.status,
      reason: r.reason,
    })),
  };
}

export async function commitImportAction(jobId: string): Promise<{
  created: number;
  skipped: number;
  errors: number;
}> {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  requireCapability(session, 'import.write');
  const db = getDb();

  const [job] = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.householdId, session.householdId)))
    .limit(1);
  if (!job) throw new Error('Job não encontrado');

  await db.update(importJobs).set({ status: 'processing' }).where(eq(importJobs.id, jobId));

  const rows = await db.select().from(importJobRows).where(eq(importJobRows.jobId, jobId));
  const [cats, centers, accs] = await Promise.all([
    db.select().from(categories).where(eq(categories.householdId, session.householdId)),
    db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
  ]);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    if (row.status !== 'ok') {
      errors += 1;
      continue;
    }
    const payload = row.payload as {
      occurredOn?: string;
      amountCents?: number;
      type?: 'income' | 'expense';
      description?: string;
      category?: string;
      costCenter?: string;
      account?: string;
    };

    const category = cats.find(
      (c) => c.name.toLowerCase() === (payload.category ?? '').toLowerCase(),
    );
    const center =
      centers.find((c) => c.name.toLowerCase() === (payload.costCenter ?? '').toLowerCase()) ??
      centers[0];
    const account =
      accs.find((a) => a.name.toLowerCase() === (payload.account ?? '').toLowerCase()) ?? accs[0];

    if (
      !category ||
      !center ||
      !account ||
      !payload.occurredOn ||
      !payload.amountCents ||
      !payload.type
    ) {
      skipped += 1;
      await db
        .update(importJobRows)
        .set({ status: 'skip', reason: 'Não foi possível resolver entidades' })
        .where(eq(importJobRows.id, row.id));
      continue;
    }

    try {
      await createTransaction(
        ctx,
        {
          householdId: session.householdId,
          costCenterId: center.id,
          categoryId: category.id,
          accountId: account.id,
          type: payload.type,
          amountCents: payload.amountCents,
          occurredOn: payload.occurredOn,
          description: payload.description,
        },
        'import',
      );
      created += 1;
    } catch (error) {
      errors += 1;
      await db
        .update(importJobRows)
        .set({
          status: 'error',
          reason: error instanceof Error ? error.message : 'Erro ao criar',
        })
        .where(eq(importJobRows.id, row.id));
    }
  }

  await db
    .update(importJobs)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(importJobs.id, jobId));

  return { created, skipped, errors };
}
