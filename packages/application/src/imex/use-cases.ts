import { requireCapability, requireSession } from '@tim/auth';
import {
  accounts,
  auditLogs,
  categories,
  categoryAliases,
  costCenters,
  exportJobs,
  importJobRows,
  importJobs,
  transactions,
} from '@tim/db';
import {
  paymentMethodMovesAccountBalance,
  resolveEntities,
  type ResolveContext,
} from '@tim/domain';
import {
  autoMapColumns,
  buildExportCsv,
  buildExportXlsx,
  buildTemplateCsv,
  detectImportFormat,
  extractYearFromFilename,
  mapPaymentMethodToAccount,
  mapRows,
  parseContasMonthlyWorkbook,
  parseSpreadsheet,
  type ImportFormat,
  type ImportRowResult,
  type ParsedImportRow,
} from '@tim/imex';
import { updateImportPreviewSchema, type UpdateImportPreviewInput } from '@tim/validators';
import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { AppContext } from '../context.js';

export type ImportPreviewEntityOption = { id: string; name: string; type?: string };

export type ImportPaymentMethodMapping = {
  method: string;
  count: number;
  suggestedAccount: string | null;
  matchedAccount: string | null;
};

export type ImportPreviewRowDto = {
  id: string;
  rowNumber: number;
  status: 'ok' | 'error' | 'skip';
  reason?: string | null;
  occurredOn?: string;
  amountCents?: number;
  type?: 'income' | 'expense';
  settlement?: 'paid' | 'pending';
  description?: string;
  category?: string;
  costCenter?: string;
  account?: string;
  paymentMethod?: string;
  tags?: string[];
};

export type ImportPreviewResult = {
  jobId: string;
  importFormat: ImportFormat;
  year: number | null;
  fileName: string;
  ok: number;
  error: number;
  skip: number;
  rows: ImportPreviewRowDto[];
  paymentMethods: ImportPaymentMethodMapping[];
  options: {
    categories: ImportPreviewEntityOption[];
    accounts: ImportPreviewEntityOption[];
    costCenters: ImportPreviewEntityOption[];
  };
};

function payloadFromResult(row: ImportRowResult): Record<string, unknown> {
  if (!row.data) return {};
  return { ...row.data };
}

function dtoFromDbRow(row: {
  id: string;
  rowNumber: number;
  status: 'ok' | 'error' | 'skip';
  reason: string | null;
  payload: Record<string, unknown> | null;
}): ImportPreviewRowDto {
  const payload = (row.payload ?? {}) as Partial<ParsedImportRow>;
  return {
    id: row.id,
    rowNumber: row.rowNumber,
    status: row.status,
    reason: row.reason,
    occurredOn: payload.occurredOn,
    amountCents: payload.amountCents,
    type: payload.type,
    settlement: payload.settlement ?? 'paid',
    description: payload.description,
    category: payload.category,
    costCenter: payload.costCenter,
    account: payload.account,
    paymentMethod: payload.paymentMethod,
    tags: payload.tags,
  };
}

function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function matchHouseholdAccount(
  suggested: string | null | undefined,
  accountOptions: ImportPreviewEntityOption[],
): string | null {
  if (!suggested) return null;
  const key = normalizeName(suggested);
  const exact = accountOptions.find((a) => normalizeName(a.name) === key);
  if (exact) return exact.name;
  const partial = accountOptions.find((a) => {
    const n = normalizeName(a.name);
    return n.includes(key) || key.includes(n);
  });
  return partial?.name ?? null;
}

function buildPaymentMethodMappings(
  rows: ImportPreviewRowDto[],
  accountOptions: ImportPreviewEntityOption[],
  importFormat: ImportFormat,
): ImportPaymentMethodMapping[] {
  if (importFormat !== 'contas-monthly') return [];

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.occurredOn) continue;
    const method = row.paymentMethod ?? '';
    counts.set(method, (counts.get(method) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([method, count]) => {
      const suggestedAccount = mapPaymentMethodToAccount(method || null) ?? null;
      return {
        method,
        count,
        suggestedAccount,
        matchedAccount: matchHouseholdAccount(suggestedAccount, accountOptions),
      };
    });
}

async function loadHouseholdOptions(
  ctx: AppContext,
  householdId: string,
): Promise<ImportPreviewResult['options']> {
  const [cats, centers, accs] = await Promise.all([
    ctx.db.select().from(categories).where(eq(categories.householdId, householdId)),
    ctx.db.select().from(costCenters).where(eq(costCenters.householdId, householdId)),
    ctx.db.select().from(accounts).where(eq(accounts.householdId, householdId)),
  ]);
  return {
    categories: cats.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    accounts: accs.map((a) => ({ id: a.id, name: a.name })),
    costCenters: centers.map((c) => ({ id: c.id, name: c.name })),
  };
}

async function buildResolveContext(ctx: AppContext, householdId: string): Promise<ResolveContext> {
  const [centers, cats, aliases, accs] = await Promise.all([
    ctx.db.select().from(costCenters).where(eq(costCenters.householdId, householdId)),
    ctx.db.select().from(categories).where(eq(categories.householdId, householdId)),
    ctx.db.select().from(categoryAliases).where(eq(categoryAliases.householdId, householdId)),
    ctx.db.select().from(accounts).where(eq(accounts.householdId, householdId)),
  ]);

  const aliasByCategory = aliases.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.categoryId] = [...(acc[row.categoryId] ?? []), row.alias];
    return acc;
  }, {});

  return {
    costCenters: centers.map((c) => ({ id: c.id, name: c.name })),
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      aliases: aliasByCategory[c.id] ?? [],
    })),
    accounts: accs.map((a) => ({
      id: a.id,
      name: a.name,
      costCenterId: a.costCenterId,
    })),
  };
}

function pickFallbackCategoryId(
  context: ResolveContext,
  type: 'income' | 'expense',
): string | null {
  const sameType = context.categories.filter((c) => c.type === type);
  const preferred = sameType.find((c) => {
    const n = c.name.toLowerCase();
    return n === 'outros' || n === 'sem categoria';
  });
  return preferred?.id ?? sameType[0]?.id ?? null;
}

/** Preferência: Pessoa Física; senão o primeiro centro do household. */
function pickFallbackCostCenterId(context: ResolveContext): string | null {
  const pessoaFisica = context.costCenters.find((c) => normalizeName(c.name) === 'pessoa fisica');
  return pessoaFisica?.id ?? context.costCenters[0]?.id ?? null;
}

function importDuplicateHash(input: {
  occurredOn: string;
  amountCents: number;
  description?: string;
  accountId: string;
}): string {
  return createHash('sha256')
    .update(
      `${input.occurredOn}|${input.amountCents}|${input.description ?? ''}|${input.accountId}`,
    )
    .digest('hex');
}

const IMPORT_INSERT_CHUNK = 150;

export function downloadImportTemplate(ctx: AppContext): { csv: string } {
  const session = requireSession(ctx.session);
  requireCapability(session, 'export.read');
  return { csv: buildTemplateCsv() };
}

export async function exportTransactions(
  ctx: AppContext,
  input: { format: 'csv' | 'xlsx'; from?: string; to?: string },
): Promise<{ base64: string; filename: string; format: 'csv' | 'xlsx' }> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'export.read');

  const filters = [
    eq(transactions.householdId, session.householdId),
    isNull(transactions.deletedAt),
    eq(transactions.status, 'paid'),
  ];
  if (input.from) filters.push(gte(transactions.occurredOn, input.from));
  if (input.to) filters.push(lte(transactions.occurredOn, input.to));

  const rows = await ctx.db
    .select()
    .from(transactions)
    .where(and(...filters));

  const [cats, centers, accs] = await Promise.all([
    ctx.db.select().from(categories).where(eq(categories.householdId, session.householdId)),
    ctx.db.select().from(costCenters).where(eq(costCenters.householdId, session.householdId)),
    ctx.db.select().from(accounts).where(eq(accounts.householdId, session.householdId)),
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

  await ctx.db.insert(exportJobs).values({
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

export async function previewImport(
  ctx: AppContext,
  input: { fileName: string; buffer: Buffer; yearOverride?: number | null },
): Promise<ImportPreviewResult> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'import.write');

  const yearOverride = input.yearOverride ?? null;
  const name = input.fileName.toLowerCase();
  const format = name.endsWith('.xlsx') ? 'xlsx' : 'csv';
  const buffer = input.buffer;
  const importFormat = detectImportFormat(buffer, format);

  let results: ImportRowResult[];
  let mapping: Record<string, string> = {};
  let year: number | null = null;

  if (importFormat === 'contas-monthly') {
    year =
      yearOverride && Number.isInteger(yearOverride)
        ? yearOverride
        : extractYearFromFilename(input.fileName);
    if (!year) {
      throw new Error(
        'Não foi possível detectar o ano no nome do arquivo. Informe o ano (ex.: 2024).',
      );
    }
    results = parseContasMonthlyWorkbook(buffer, year);
    mapping = { format: 'contas-monthly', year: String(year) };
  } else {
    const parsed = parseSpreadsheet(buffer, format);
    const columnMapping = autoMapColumns(parsed.headers);
    mapping = columnMapping as unknown as Record<string, string>;
    results = mapRows(parsed.rows, columnMapping);
  }

  const [job] = await ctx.db
    .insert(importJobs)
    .values({
      householdId: session.householdId,
      userId: session.userId,
      status: 'preview',
      fileName: input.fileName,
      format,
      mapping,
    })
    .returning();

  if (!job) throw new Error('Falha ao criar job');

  let storedRows: Array<{
    id: string;
    rowNumber: number;
    status: 'ok' | 'error' | 'skip';
    reason: string | null;
    payload: Record<string, unknown> | null;
  }> = [];

  if (results.length > 0) {
    storedRows = await ctx.db
      .insert(importJobRows)
      .values(
        results.map((row) => ({
          jobId: job.id,
          rowNumber: row.rowNumber,
          status: row.status,
          payload: payloadFromResult(row),
          reason: row.reason,
        })),
      )
      .returning();
  }

  const options = await loadHouseholdOptions(ctx, session.householdId);
  const rowDtos = storedRows.map(dtoFromDbRow);

  return {
    jobId: job.id,
    importFormat,
    year,
    fileName: input.fileName,
    ok: storedRows.filter((r) => r.status === 'ok').length,
    error: storedRows.filter((r) => r.status === 'error').length,
    skip: storedRows.filter((r) => r.status === 'skip').length,
    rows: rowDtos,
    paymentMethods: buildPaymentMethodMappings(rowDtos, options.accounts, importFormat),
    options,
  };
}

export async function updateImportPreview(
  ctx: AppContext,
  input: UpdateImportPreviewInput,
): Promise<{ updated: number }> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'import.write');
  const parsed = updateImportPreviewSchema.parse(input);

  const [job] = await ctx.db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, parsed.jobId), eq(importJobs.householdId, session.householdId)))
    .limit(1);
  if (!job) throw new Error('Job não encontrado');
  if (job.status !== 'preview') {
    throw new Error('Job não está em preview');
  }

  const existing = await ctx.db
    .select({ id: importJobRows.id })
    .from(importJobRows)
    .where(
      and(
        eq(importJobRows.jobId, parsed.jobId),
        inArray(
          importJobRows.id,
          parsed.rows.map((r) => r.id),
        ),
      ),
    );
  const allowed = new Set(existing.map((r) => r.id));

  let updated = 0;
  for (const row of parsed.rows) {
    if (!allowed.has(row.id)) continue;
    const payload: ParsedImportRow = {
      occurredOn: row.occurredOn,
      amountCents: row.amountCents,
      type: row.type,
      settlement: row.settlement ?? 'paid',
      description: row.description ?? undefined,
      category: row.category ?? undefined,
      costCenter: row.costCenter ?? undefined,
      account: row.account ?? undefined,
      paymentMethod: row.paymentMethod ?? undefined,
      tags: row.tags,
    };
    await ctx.db
      .update(importJobRows)
      .set({
        status: row.status === 'error' ? 'error' : row.status,
        payload,
        reason: row.reason ?? null,
      })
      .where(and(eq(importJobRows.id, row.id), eq(importJobRows.jobId, parsed.jobId)));
    updated += 1;
  }

  return { updated };
}

export async function commitImport(
  ctx: AppContext,
  jobId: string,
): Promise<{ created: number; skipped: number; errors: number }> {
  const session = requireSession(ctx.session);
  requireCapability(session, 'import.write');

  const [job] = await ctx.db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.householdId, session.householdId)))
    .limit(1);
  if (!job) throw new Error('Job não encontrado');

  await ctx.db.update(importJobs).set({ status: 'processing' }).where(eq(importJobs.id, jobId));

  const rows = await ctx.db.select().from(importJobRows).where(eq(importJobRows.jobId, jobId));
  const resolveContext = await buildResolveContext(ctx, session.householdId);
  const defaultCostCenterId = pickFallbackCostCenterId(resolveContext);
  const validAccountIds = new Set(resolveContext.accounts.map((a) => a.id));

  type ReadyRow = {
    rowId: string;
    costCenterId: string;
    categoryId: string;
    accountId: string;
    type: 'income' | 'expense';
    settlement: 'paid' | 'pending';
    amountCents: number;
    occurredOn: string;
    description?: string;
    tags?: string[];
  };

  const toInsert: ReadyRow[] = [];
  const skipRowIds: string[] = [];
  const errorUpdates: Array<{ id: string; reason: string }> = [];
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    if (row.status === 'skip') {
      skipped += 1;
      continue;
    }
    if (row.status === 'error') {
      errors += 1;
      continue;
    }

    const payload = row.payload as Partial<ParsedImportRow>;
    if (!payload.occurredOn || !payload.amountCents || !payload.type || payload.amountCents <= 0) {
      errors += 1;
      errorUpdates.push({ id: row.id, reason: 'Payload incompleto' });
      continue;
    }

    const resolved = resolveEntities(
      {
        category: payload.category,
        costCenter: payload.costCenter,
        account: payload.account,
      },
      resolveContext,
    );

    const costCenterId = resolved.costCenterId ?? defaultCostCenterId;
    const accountId = resolved.accountId ?? resolveContext.accounts[0]?.id ?? null;
    const categoryId = resolved.categoryId ?? pickFallbackCategoryId(resolveContext, payload.type);

    if (!categoryId || !costCenterId || !accountId || !validAccountIds.has(accountId)) {
      skipped += 1;
      skipRowIds.push(row.id);
      continue;
    }

    toInsert.push({
      rowId: row.id,
      costCenterId,
      categoryId,
      accountId,
      type: payload.type,
      settlement: payload.settlement === 'pending' ? 'pending' : 'paid',
      amountCents: payload.amountCents,
      occurredOn: payload.occurredOn,
      description: payload.description,
      tags: payload.tags,
    });
  }

  const balanceDeltaByAccount = new Map<string, number>();
  const movesBalance = paymentMethodMovesAccountBalance({
    type: 'account',
    paymentRail: 'pix',
  });

  for (let i = 0; i < toInsert.length; i += IMPORT_INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + IMPORT_INSERT_CHUNK);
    await ctx.db.insert(transactions).values(
      chunk.map((row) => {
        const isPaid = row.settlement === 'paid';
        return {
          householdId: session.householdId,
          costCenterId: row.costCenterId,
          categoryId: row.categoryId,
          accountId: row.accountId,
          type: row.type,
          status: isPaid ? ('paid' as const) : ('pending' as const),
          amountCents: row.amountCents,
          occurredOn: row.occurredOn,
          dueOn: row.occurredOn,
          paidOn: isPaid ? row.occurredOn : null,
          description: row.description,
          tags: row.tags ?? [],
          source: 'import',
          duplicateHash: importDuplicateHash({
            occurredOn: row.occurredOn,
            amountCents: row.amountCents,
            description: row.description,
            accountId: row.accountId,
          }),
          createdBy: session.userId,
        };
      }),
    );

    if (movesBalance) {
      for (const row of chunk) {
        if (row.settlement !== 'paid') continue;
        const delta = row.type === 'expense' ? -row.amountCents : row.amountCents;
        balanceDeltaByAccount.set(
          row.accountId,
          (balanceDeltaByAccount.get(row.accountId) ?? 0) + delta,
        );
      }
    }
  }

  for (const [accountId, delta] of balanceDeltaByAccount) {
    if (delta === 0) continue;
    await ctx.db
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, accountId), eq(accounts.householdId, session.householdId)));
  }

  if (skipRowIds.length > 0) {
    await ctx.db
      .update(importJobRows)
      .set({ status: 'skip', reason: 'Não foi possível resolver entidades' })
      .where(inArray(importJobRows.id, skipRowIds));
  }

  for (const err of errorUpdates) {
    await ctx.db
      .update(importJobRows)
      .set({ status: 'error', reason: err.reason })
      .where(eq(importJobRows.id, err.id));
  }

  await ctx.db
    .update(importJobs)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(importJobs.id, jobId));

  await ctx.db.insert(auditLogs).values({
    householdId: session.householdId,
    userId: session.userId,
    action: 'import.commit',
    resourceType: 'import_job',
    resourceId: jobId,
    source: 'import',
    metadata: {
      created: toInsert.length,
      skipped,
      errors,
    },
  });

  return { created: toInsert.length, skipped, errors };
}
