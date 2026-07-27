import { createHash } from 'node:crypto';
import { encryptSensitiveField } from '@tim/crypto';
import type { Database } from '@tim/db';
import {
  accounts,
  categories,
  costCenters,
  financings,
  households,
  installments,
  institutions,
  memberships,
  planItems,
  plans,
  seedHouseholdDefaults,
  accountTransfers,
  transactionSeries,
  transactions,
  userPreferences,
} from '@tim/db';
import { buildAmortizationSchedule, dueOnForMonth, yearMonthFromIso } from '@tim/domain';
import { and, eq, gte, lte } from 'drizzle-orm';
import { DEMO } from './session';

function hashDup(input: {
  occurredOn: string;
  amountCents: number;
  description: string;
  accountId: string;
}): string {
  return createHash('sha256')
    .update(`${input.occurredOn}|${input.amountCents}|${input.description}|${input.accountId}`)
    .digest('hex');
}

function monthDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Dia `day` do mês deslocado por `monthOffset` (0 = atual, -1 = anterior…). */
function monthFixedDay(monthOffset: number, day: number): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, day));
  return date.toISOString().slice(0, 10);
}

export interface DemoSeedResult {
  householdId: string;
  costCenterPfId: string;
  costCenterEmpresaId: string;
  accountCarteiraId: string;
  accountNubankId: string;
  transactionCount: number;
  financingId: string;
}

/**
 * Idempotente: se já existir membership do demo user, reusa o household
 * e só completa dados faltantes de forma conservadora (não duplica tx se já houver).
 */
export async function seedDemoWorld(
  db: Database,
  encryptionSecret: string,
): Promise<DemoSeedResult> {
  const existingMembership = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, DEMO.userId))
    .limit(1);

  let householdId: string;

  if (existingMembership[0]) {
    householdId = existingMembership[0].householdId;
  } else {
    const [household] = await db
      .insert(households)
      .values({ name: DEMO.householdName })
      .returning();
    if (!household) throw new Error('Falha ao criar household demo');
    householdId = household.id;

    await db.insert(memberships).values([
      {
        householdId,
        userId: DEMO.userId,
        email: DEMO.email,
        role: 'admin',
      },
      {
        householdId,
        userId: DEMO.spouseUserId,
        email: DEMO.spouseEmail,
        role: 'admin',
      },
    ]);

    await seedHouseholdDefaults(db, householdId);

    await db.insert(userPreferences).values([
      {
        householdId,
        userId: DEMO.userId,
        emailDueReminders: true,
        reminderWindowsDays: [7, 3, 1],
        ttsEnabled: false,
      },
      {
        householdId,
        userId: DEMO.spouseUserId,
        emailDueReminders: true,
        reminderWindowsDays: [3, 1],
        ttsEnabled: true,
      },
    ]);
  }

  // Ensure Empresa X cost center
  let empresa = (
    await db
      .select()
      .from(costCenters)
      .where(and(eq(costCenters.householdId, householdId), eq(costCenters.name, 'Empresa X')))
      .limit(1)
  )[0];

  if (!empresa) {
    const [created] = await db
      .insert(costCenters)
      .values({
        householdId,
        name: 'Empresa X',
        color: '#3d5a80',
        isSystem: false,
      })
      .returning();
    empresa = created;
  }
  if (!empresa) throw new Error('Centro Empresa X ausente');

  const pf = (
    await db
      .select()
      .from(costCenters)
      .where(and(eq(costCenters.householdId, householdId), eq(costCenters.name, 'Pessoa Física')))
      .limit(1)
  )[0];
  if (!pf) throw new Error('Centro Pessoa Física ausente — rode seedHouseholdDefaults');

  let carteira = (
    await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.householdId, householdId), eq(accounts.name, 'Carteira / Dinheiro')))
      .limit(1)
  )[0];
  if (!carteira) {
    const [created] = await db
      .insert(accounts)
      .values({ householdId, costCenterId: pf.id, name: 'Carteira / Dinheiro' })
      .returning();
    carteira = created;
  }
  if (!carteira) throw new Error('Conta Carteira ausente');

  let nubank = (
    await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.householdId, householdId), eq(accounts.name, 'Nubank PF')))
      .limit(1)
  )[0];
  if (!nubank) {
    const [created] = await db
      .insert(accounts)
      .values({ householdId, costCenterId: pf.id, name: 'Nubank PF' })
      .returning();
    nubank = created;
  }
  if (!nubank) throw new Error('Conta Nubank ausente');

  // Banco Nubank + caixinhas
  let nubankBank = (
    await db
      .select()
      .from(institutions)
      .where(and(eq(institutions.householdId, householdId), eq(institutions.name, 'Nubank')))
      .limit(1)
  )[0];
  if (!nubankBank) {
    const [created] = await db
      .insert(institutions)
      .values({ householdId, name: 'Nubank' })
      .returning();
    nubankBank = created;
  }

  if (nubankBank) {
    await db
      .update(accounts)
      .set({
        institutionId: nubankBank.id,
        kind: 'checking',
        balanceCents: 2_450_00,
        yieldType: 'none',
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, nubank.id));

    const potDefs = [
      {
        name: 'Caixinha Reserva',
        balanceCents: 8_000_00,
        yieldType: 'cdi' as const,
        yieldBps: 10_000,
      },
      {
        name: 'Caixinha Viagem',
        balanceCents: 1_250_00,
        yieldType: 'cdi' as const,
        yieldBps: 10_000,
      },
      {
        name: 'CDB Emergência',
        balanceCents: 5_000_00,
        yieldType: 'fixed_annual' as const,
        yieldBps: 1315,
      },
    ];

    for (const pot of potDefs) {
      const exists = (
        await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.householdId, householdId), eq(accounts.name, pot.name)))
          .limit(1)
      )[0];
      if (!exists) {
        await db.insert(accounts).values({
          householdId,
          costCenterId: pf.id,
          institutionId: nubankBank.id,
          parentAccountId: nubank.id,
          name: pot.name,
          kind: 'investment_pot',
          balanceCents: pot.balanceCents,
          yieldType: pot.yieldType,
          yieldBps: pot.yieldBps,
        });
      }
    }

    const viagem = (
      await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.householdId, householdId), eq(accounts.name, 'Caixinha Viagem')))
        .limit(1)
    )[0];

    const existingTransfer = (
      await db
        .select({ id: accountTransfers.id })
        .from(accountTransfers)
        .where(eq(accountTransfers.householdId, householdId))
        .limit(1)
    )[0];

    if (viagem && !existingTransfer) {
      const amountCents = 200_00;
      const [freshNubank] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, nubank.id))
        .limit(1);
      if (freshNubank && freshNubank.balanceCents >= amountCents) {
        await db.insert(accountTransfers).values({
          householdId,
          fromAccountId: nubank.id,
          toAccountId: viagem.id,
          amountCents,
          occurredOn: monthDay(-2),
          description: 'Guardar para viagem',
          createdBy: DEMO.userId,
        });
        await db
          .update(accounts)
          .set({
            balanceCents: freshNubank.balanceCents - amountCents,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, nubank.id));
        await db
          .update(accounts)
          .set({
            balanceCents: viagem.balanceCents + amountCents,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, viagem.id));
      }
    }
  }

  await db
    .update(accounts)
    .set({ kind: 'cash', balanceCents: 35_000, updatedAt: new Date() })
    .where(eq(accounts.id, carteira.id));

  let contaPj = (
    await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.householdId, householdId), eq(accounts.name, 'Conta PJ Empresa X')))
      .limit(1)
  )[0];
  if (!contaPj) {
    const [created] = await db
      .insert(accounts)
      .values({ householdId, costCenterId: empresa.id, name: 'Conta PJ Empresa X' })
      .returning();
    contaPj = created;
  }
  if (!contaPj) throw new Error('Conta PJ ausente');

  // Wire defaults
  await db
    .update(userPreferences)
    .set({
      defaultCostCenterId: pf.id,
      defaultAccountId: nubank.id,
      incomeDay: 5,
    })
    .where(
      and(eq(userPreferences.householdId, householdId), eq(userPreferences.userId, DEMO.userId)),
    );

  const cats = await db.select().from(categories).where(eq(categories.householdId, householdId));

  const byName = (name: string) => cats.find((c) => c.name === name);
  const supermercado =
    byName('Supermercado') ?? byName('Alimentação') ?? cats.find((c) => c.type === 'expense');
  const transporte = byName('Transporte') ?? supermercado;
  const moradia = byName('Moradia') ?? supermercado;
  const lazer = byName('Lazer') ?? supermercado;
  const salario = byName('Salário') ?? cats.find((c) => c.type === 'income');
  const outrosDespesa = byName('Outros') ?? supermercado;

  if (!supermercado || !salario || !transporte || !moradia || !lazer || !outrosDespesa) {
    throw new Error('Categorias seed incompletas');
  }

  const existingTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.householdId, householdId))
    .limit(1);

  const historyProbe = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        lte(transactions.occurredOn, monthFixedDay(-2, 28)),
      ),
    )
    .limit(1);

  let transactionCount = 0;

  const deliveryId = byName('Delivery')?.id ?? supermercado.id;

  type Sample = {
    type: 'income' | 'expense';
    amountCents: number;
    occurredOn: string;
    description: string;
    categoryId: string;
    costCenterId: string;
    accountId: string;
    notes?: string;
  };

  const currentMonthSamples: Sample[] = [
    {
      type: 'income',
      amountCents: 850_000,
      occurredOn: monthDay(-20),
      description: 'Salário',
      categoryId: salario.id,
      costCenterId: pf.id,
      accountId: nubank.id,
    },
    {
      type: 'expense',
      amountCents: 4_800,
      occurredOn: monthDay(-10),
      description: 'Uber',
      categoryId: transporte.id,
      costCenterId: pf.id,
      accountId: carteira.id,
    },
    {
      type: 'expense',
      amountCents: 220_000,
      occurredOn: monthDay(-8),
      description: 'Aluguel',
      categoryId: moradia.id,
      costCenterId: pf.id,
      accountId: nubank.id,
    },
    {
      type: 'expense',
      amountCents: 15_900,
      occurredOn: monthDay(-5),
      description: 'Cinema e jantar',
      categoryId: lazer.id,
      costCenterId: pf.id,
      accountId: nubank.id,
    },
    {
      type: 'expense',
      amountCents: 89_000,
      occurredOn: monthDay(-3),
      description: 'Software assinatura PJ',
      categoryId: outrosDespesa.id,
      costCenterId: empresa.id,
      accountId: contaPj.id,
    },
    {
      type: 'expense',
      amountCents: 12_300,
      occurredOn: monthDay(-1),
      description: 'Delivery',
      categoryId: deliveryId,
      costCenterId: pf.id,
      accountId: nubank.id,
    },
  ];

  const historySamples: Sample[] = [];
  for (const monthOffset of [-1, -2, -3, -4, -5]) {
    const salaryBump = monthOffset * -8_000;
    historySamples.push(
      {
        type: 'income',
        amountCents: 850_000 + salaryBump,
        occurredOn: monthFixedDay(monthOffset, 5),
        description: 'Salário',
        categoryId: salario.id,
        costCenterId: pf.id,
        accountId: nubank.id,
      },
      {
        type: 'expense',
        amountCents: 220_000,
        occurredOn: monthFixedDay(monthOffset, 8),
        description: 'Aluguel',
        categoryId: moradia.id,
        costCenterId: pf.id,
        accountId: nubank.id,
      },
      {
        type: 'expense',
        amountCents: 18_000 + Math.abs(monthOffset) * 1_200,
        occurredOn: monthFixedDay(monthOffset, 16),
        description: 'Transporte',
        categoryId: transporte.id,
        costCenterId: pf.id,
        accountId: carteira.id,
      },
      {
        type: 'expense',
        amountCents: 25_000 + Math.abs(monthOffset) * 2_000,
        occurredOn: monthFixedDay(monthOffset, 20),
        description: 'Lazer',
        categoryId: lazer.id,
        costCenterId: pf.id,
        accountId: nubank.id,
      },
      {
        type: 'expense',
        amountCents: 75_000 + Math.abs(monthOffset) * 4_000,
        occurredOn: monthFixedDay(monthOffset, 22),
        description: 'Despesa PJ',
        categoryId: outrosDespesa.id,
        costCenterId: empresa.id,
        accountId: contaPj.id,
      },
    );
    if (monthOffset <= -3) {
      historySamples.push({
        type: 'expense',
        amountCents: 45_000 + Math.abs(monthOffset) * 3_500,
        occurredOn: monthFixedDay(monthOffset, 12),
        description: 'Supermercado',
        categoryId: supermercado.id,
        costCenterId: pf.id,
        accountId: nubank.id,
      });
    }
  }

  /** Padrão de atenção: R$ 1.000 → R$ 1.500 → R$ 1.000 */
  const attentionSamples: Sample[] = [
    {
      type: 'expense',
      amountCents: 100_000,
      occurredOn: monthFixedDay(-2, 15),
      description: 'Supermercado · baseline',
      categoryId: supermercado.id,
      costCenterId: pf.id,
      accountId: nubank.id,
    },
    {
      type: 'expense',
      amountCents: 150_000,
      occurredOn: monthFixedDay(-1, 15),
      description: 'Supermercado · pico',
      categoryId: supermercado.id,
      costCenterId: pf.id,
      accountId: nubank.id,
    },
    {
      type: 'expense',
      amountCents: 100_000,
      occurredOn: monthFixedDay(0, 15),
      description: 'Supermercado · retorno',
      categoryId: supermercado.id,
      costCenterId: pf.id,
      accountId: nubank.id,
    },
  ];

  async function insertSamples(samples: Sample[]): Promise<number> {
    let inserted = 0;
    for (const sample of samples) {
      await db.insert(transactions).values({
        householdId,
        costCenterId: sample.costCenterId,
        categoryId: sample.categoryId,
        accountId: sample.accountId,
        type: sample.type,
        status: 'paid',
        amountCents: sample.amountCents,
        occurredOn: sample.occurredOn,
        dueOn: sample.occurredOn,
        paidOn: sample.occurredOn,
        description: sample.description,
        notesEncrypted: sample.notes
          ? encryptSensitiveField(sample.notes, encryptionSecret, householdId)
          : null,
        tags: ['demo'],
        source: 'manual',
        duplicateHash: hashDup({
          occurredOn: sample.occurredOn,
          amountCents: sample.amountCents,
          description: sample.description,
          accountId: sample.accountId,
        }),
        createdBy: DEMO.userId,
      });
      inserted += 1;
    }
    return inserted;
  }

  if (existingTx.length === 0) {
    transactionCount += await insertSamples([
      ...currentMonthSamples,
      ...historySamples,
      ...attentionSamples,
    ]);
  } else if (historyProbe.length === 0) {
    transactionCount += await insertSamples([...historySamples, ...attentionSamples]);
    const all = await db
      .select()
      .from(transactions)
      .where(eq(transactions.householdId, householdId));
    transactionCount = all.length;
  } else {
    // Garante o padrão limpo de atenção no supermercado (últimos 3 meses).
    await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.categoryId, supermercado.id),
          gte(transactions.occurredOn, monthFixedDay(-2, 1)),
        ),
      );
    transactionCount += await insertSamples(attentionSamples);
    const all = await db
      .select()
      .from(transactions)
      .where(eq(transactions.householdId, householdId));
    transactionCount = all.length;
  }

  let financing: typeof financings.$inferSelect | undefined = (
    await db
      .select()
      .from(financings)
      .where(and(eq(financings.householdId, householdId), eq(financings.name, 'Carro Demo')))
      .limit(1)
  )[0];

  if (financing && financing.amortizationSystem !== 'price') {
    await db.delete(installments).where(eq(installments.financingId, financing.id));
    await db.delete(financings).where(eq(financings.id, financing.id));
    financing = undefined;
  }

  if (!financing) {
    const firstDueOn = monthDay(5);
    const installmentCount = 36;
    const principalCents = 45_000_00;
    const annualRateBps = 1890;
    const amortization = buildAmortizationSchedule({
      system: 'price',
      principalCents,
      installmentCount,
      annualRateBps,
      firstDueOn,
    });
    const [created] = await db
      .insert(financings)
      .values({
        householdId,
        costCenterId: pf.id,
        accountId: nubank.id,
        name: 'Carro Demo',
        institution: 'Banco Demo',
        principalCents,
        installmentCount,
        installmentAmountCents: amortization.firstInstallmentCents,
        annualRateBps,
        amortizationSystem: 'price',
        category: 'vehicle',
        firstDueOn,
      })
      .returning();
    financing = created;
    if (!financing) throw new Error('Falha financiamento demo');

    await db.insert(installments).values(
      amortization.schedule.map((item) => ({
        householdId,
        financingId: financing!.id,
        number: item.number,
        dueOn: item.dueOn,
        amountCents: item.amountCents,
        interestCents: item.interestCents,
        principalCents: item.principalCents,
        balanceAfterCents: item.balanceAfterCents,
        status: 'pending' as const,
      })),
    );
  }

  // Espelha parcelas pending → lançamentos a pagar (idempotente)
  const pendingInstallments = await db
    .select()
    .from(installments)
    .where(
      and(
        eq(installments.householdId, householdId),
        eq(installments.financingId, financing.id),
        eq(installments.status, 'pending'),
      ),
    );

  for (const installment of pendingInstallments) {
    if (installment.transactionId) continue;
    const [tx] = await db
      .insert(transactions)
      .values({
        householdId,
        costCenterId: financing.costCenterId,
        categoryId: moradia.id,
        accountId: financing.accountId,
        type: 'expense',
        status: 'pending',
        amountCents: installment.amountCents,
        occurredOn: installment.dueOn,
        dueOn: installment.dueOn,
        description: `Parcela ${installment.number} — ${financing.name}`,
        tags: ['demo', 'financing'],
        source: 'financing',
        installmentId: installment.id,
        duplicateHash: hashDup({
          occurredOn: installment.dueOn,
          amountCents: installment.amountCents,
          description: `Parcela ${installment.number} — ${financing.name}`,
          accountId: financing.accountId,
        }),
        createdBy: DEMO.userId,
      })
      .returning();
    if (tx) {
      await db
        .update(installments)
        .set({ transactionId: tx.id })
        .where(eq(installments.id, installment.id));
    }
  }

  const impostos = byName('Impostos/Taxas') ?? outrosDespesa;
  const currentYm = yearMonthFromIso(monthDay(0));

  // Conta fixa com valor (energia)
  let energiaSeries = (
    await db
      .select()
      .from(transactionSeries)
      .where(
        and(
          eq(transactionSeries.householdId, householdId),
          eq(transactionSeries.description, 'Energia elétrica'),
        ),
      )
      .limit(1)
  )[0];

  if (!energiaSeries) {
    const [created] = await db
      .insert(transactionSeries)
      .values({
        householdId,
        costCenterId: pf.id,
        categoryId: moradia.id,
        accountId: nubank.id,
        type: 'expense',
        description: 'Energia elétrica',
        interval: 'monthly',
        dueDay: 12,
        defaultAmountCents: 28_500,
        isActive: true,
      })
      .returning();
    energiaSeries = created;
  }

  if (energiaSeries) {
    const dueOn = dueOnForMonth(currentYm, energiaSeries.dueDay);
    const exists = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.seriesId, energiaSeries.id),
          eq(transactions.dueOn, dueOn),
        ),
      )
      .limit(1);
    if (exists.length === 0) {
      await db.insert(transactions).values({
        householdId,
        costCenterId: energiaSeries.costCenterId,
        categoryId: energiaSeries.categoryId,
        accountId: energiaSeries.accountId,
        type: 'expense',
        status: 'pending',
        amountCents: energiaSeries.defaultAmountCents,
        occurredOn: dueOn,
        dueOn,
        description: energiaSeries.description,
        tags: ['demo', 'fixed'],
        source: 'series',
        seriesId: energiaSeries.id,
        duplicateHash: hashDup({
          occurredOn: dueOn,
          amountCents: energiaSeries.defaultAmountCents ?? 0,
          description: energiaSeries.description,
          accountId: energiaSeries.accountId,
        }),
        createdBy: DEMO.userId,
      });
    }
  }

  // Conta fixa sem valor (imposto PJ) + histórico para média
  let impostoSeries = (
    await db
      .select()
      .from(transactionSeries)
      .where(
        and(
          eq(transactionSeries.householdId, householdId),
          eq(transactionSeries.description, 'Imposto Empresa X'),
        ),
      )
      .limit(1)
  )[0];

  if (!impostoSeries) {
    const [created] = await db
      .insert(transactionSeries)
      .values({
        householdId,
        costCenterId: empresa.id,
        categoryId: impostos.id,
        accountId: contaPj.id,
        type: 'expense',
        description: 'Imposto Empresa X',
        interval: 'monthly',
        dueDay: 20,
        defaultAmountCents: null,
        isActive: true,
      })
      .returning();
    impostoSeries = created;

    for (const monthOffset of [-3, -2, -1]) {
      const paidOn = monthFixedDay(monthOffset, 20);
      const amountCents = 180_000 + Math.abs(monthOffset) * 12_000;
      await db.insert(transactions).values({
        householdId,
        costCenterId: empresa.id,
        categoryId: impostos.id,
        accountId: contaPj.id,
        type: 'expense',
        status: 'paid',
        amountCents,
        occurredOn: paidOn,
        dueOn: paidOn,
        paidOn,
        description: 'Imposto Empresa X',
        tags: ['demo', 'fixed'],
        source: 'series',
        seriesId: created?.id,
        duplicateHash: hashDup({
          occurredOn: paidOn,
          amountCents,
          description: 'Imposto Empresa X',
          accountId: contaPj.id,
        }),
        createdBy: DEMO.userId,
      });
    }
  }

  if (impostoSeries) {
    const dueOn = dueOnForMonth(currentYm, impostoSeries.dueDay);
    const exists = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.seriesId, impostoSeries.id),
          eq(transactions.dueOn, dueOn),
        ),
      )
      .limit(1);
    if (exists.length === 0) {
      await db.insert(transactions).values({
        householdId,
        costCenterId: impostoSeries.costCenterId,
        categoryId: impostoSeries.categoryId,
        accountId: impostoSeries.accountId,
        type: 'expense',
        status: 'pending',
        amountCents: null,
        occurredOn: dueOn,
        dueOn,
        description: impostoSeries.description,
        tags: ['demo', 'fixed'],
        source: 'series',
        seriesId: impostoSeries.id,
        duplicateHash: hashDup({
          occurredOn: dueOn,
          amountCents: 0,
          description: impostoSeries.description,
          accountId: impostoSeries.accountId,
        }),
        createdBy: DEMO.userId,
      });
    }
  }

  // Receitas mensais (salário variável + VR) — só confirma o valor
  let salarioSeries = (
    await db
      .select()
      .from(transactionSeries)
      .where(
        and(
          eq(transactionSeries.householdId, householdId),
          eq(transactionSeries.description, 'Salário · Contrato Empresa'),
        ),
      )
      .limit(1)
  )[0];

  if (!salarioSeries) {
    const [created] = await db
      .insert(transactionSeries)
      .values({
        householdId,
        costCenterId: pf.id,
        categoryId: salario.id,
        accountId: nubank.id,
        type: 'income',
        description: 'Salário · Contrato Empresa',
        interval: 'monthly',
        dueDay: 5,
        defaultAmountCents: null,
        isActive: true,
      })
      .returning();
    salarioSeries = created;

    for (const monthOffset of [-3, -2, -1]) {
      const paidOn = monthFixedDay(monthOffset, 5);
      const amountCents = 850_000 + Math.abs(monthOffset) * 8_000;
      await db.insert(transactions).values({
        householdId,
        costCenterId: pf.id,
        categoryId: salario.id,
        accountId: nubank.id,
        type: 'income',
        status: 'paid',
        amountCents,
        occurredOn: paidOn,
        dueOn: paidOn,
        paidOn,
        description: 'Salário · Contrato Empresa',
        tags: ['demo', 'income-series'],
        source: 'series',
        seriesId: created?.id,
        duplicateHash: hashDup({
          occurredOn: paidOn,
          amountCents,
          description: 'Salário · Contrato Empresa',
          accountId: nubank.id,
        }),
        createdBy: DEMO.userId,
      });
    }
  }

  if (salarioSeries) {
    const dueOn = dueOnForMonth(currentYm, salarioSeries.dueDay);
    const exists = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.seriesId, salarioSeries.id),
          eq(transactions.dueOn, dueOn),
        ),
      )
      .limit(1);
    if (exists.length === 0) {
      await db.insert(transactions).values({
        householdId,
        costCenterId: salarioSeries.costCenterId,
        categoryId: salarioSeries.categoryId,
        accountId: salarioSeries.accountId,
        type: 'income',
        status: 'pending',
        amountCents: null,
        occurredOn: dueOn,
        dueOn,
        description: salarioSeries.description,
        tags: ['demo', 'income-series'],
        source: 'series',
        seriesId: salarioSeries.id,
        duplicateHash: hashDup({
          occurredOn: dueOn,
          amountCents: 0,
          description: salarioSeries.description,
          accountId: salarioSeries.accountId,
        }),
        createdBy: DEMO.userId,
      });
    }
  }

  let vrSeries = (
    await db
      .select()
      .from(transactionSeries)
      .where(
        and(
          eq(transactionSeries.householdId, householdId),
          eq(transactionSeries.description, 'VR · Benefício'),
        ),
      )
      .limit(1)
  )[0];

  if (!vrSeries) {
    const [created] = await db
      .insert(transactionSeries)
      .values({
        householdId,
        costCenterId: pf.id,
        categoryId: salario.id,
        accountId: nubank.id,
        type: 'income',
        description: 'VR · Benefício',
        interval: 'monthly',
        dueDay: 1,
        defaultAmountCents: null,
        isActive: true,
      })
      .returning();
    vrSeries = created;

    for (const monthOffset of [-3, -2, -1]) {
      const paidOn = monthFixedDay(monthOffset, 1);
      const amountCents = 65_000 + Math.abs(monthOffset) * 1_500;
      await db.insert(transactions).values({
        householdId,
        costCenterId: pf.id,
        categoryId: salario.id,
        accountId: nubank.id,
        type: 'income',
        status: 'paid',
        amountCents,
        occurredOn: paidOn,
        dueOn: paidOn,
        paidOn,
        description: 'VR · Benefício',
        tags: ['demo', 'income-series'],
        source: 'series',
        seriesId: created?.id,
        duplicateHash: hashDup({
          occurredOn: paidOn,
          amountCents,
          description: 'VR · Benefício',
          accountId: nubank.id,
        }),
        createdBy: DEMO.userId,
      });
    }
  }

  if (vrSeries) {
    const dueOn = dueOnForMonth(currentYm, vrSeries.dueDay);
    const exists = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          eq(transactions.seriesId, vrSeries.id),
          eq(transactions.dueOn, dueOn),
        ),
      )
      .limit(1);
    if (exists.length === 0) {
      await db.insert(transactions).values({
        householdId,
        costCenterId: vrSeries.costCenterId,
        categoryId: vrSeries.categoryId,
        accountId: vrSeries.accountId,
        type: 'income',
        status: 'pending',
        amountCents: null,
        occurredOn: dueOn,
        dueOn,
        description: vrSeries.description,
        tags: ['demo', 'income-series'],
        source: 'series',
        seriesId: vrSeries.id,
        duplicateHash: hashDup({
          occurredOn: dueOn,
          amountCents: 0,
          description: vrSeries.description,
          accountId: vrSeries.accountId,
        }),
        createdBy: DEMO.userId,
      });
    }
  }

  // Conta variável pontual
  const vacinaDue = monthFixedDay(0, 25);
  const vacinaExists = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        eq(transactions.description, 'Vacina do pet'),
        eq(transactions.status, 'pending'),
      ),
    )
    .limit(1);
  if (vacinaExists.length === 0) {
    await db.insert(transactions).values({
      householdId,
      costCenterId: pf.id,
      categoryId: lazer.id,
      accountId: nubank.id,
      type: 'expense',
      status: 'pending',
      amountCents: 18_000,
      occurredOn: vacinaDue,
      dueOn: vacinaDue,
      description: 'Vacina do pet',
      tags: ['demo', 'variable'],
      source: 'manual',
      duplicateHash: hashDup({
        occurredOn: vacinaDue,
        amountCents: 18_000,
        description: 'Vacina do pet',
        accountId: nubank.id,
      }),
      createdBy: DEMO.userId,
    });
  }

  const allTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.householdId, householdId));
  transactionCount = allTx.length;

  const viagemPot = (
    await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.householdId, householdId), eq(accounts.name, 'Caixinha Viagem')))
      .limit(1)
  )[0];

  const existingPlan = (
    await db
      .select()
      .from(plans)
      .where(and(eq(plans.householdId, householdId), eq(plans.name, 'Viagem Japão 2027')))
      .limit(1)
  )[0];

  if (!existingPlan && viagemPot) {
    const [plan] = await db
      .insert(plans)
      .values({
        householdId,
        kind: 'travel',
        name: 'Viagem Japão 2027',
        targetDate: '2027-06-15',
        linkedAccountId: viagemPot.id,
      })
      .returning();
    if (plan) {
      await db.insert(planItems).values([
        {
          householdId,
          planId: plan.id,
          label: 'Passagem',
          amountCents: 3_000_00,
          sortOrder: 0,
        },
        {
          householdId,
          planId: plan.id,
          label: 'Hotel',
          amountCents: 5_000_00,
          sortOrder: 1,
        },
        {
          householdId,
          planId: plan.id,
          label: 'Passeios e comida',
          amountCents: 2_000_00,
          sortOrder: 2,
        },
      ]);
    }
  }

  return {
    householdId,
    costCenterPfId: pf.id,
    costCenterEmpresaId: empresa.id,
    accountCarteiraId: carteira.id,
    accountNubankId: nubank.id,
    transactionCount,
    financingId: financing.id,
  };
}
