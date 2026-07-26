# Playbook: adicionar entidade

Checklist para nova entidade de negócio (ex.: `budgets`, `goals`).

## 1. Schema Drizzle

Arquivo: `/home/flaesh/time-is-money/packages/db/src/schema/index.ts`

```typescript
export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  // ... campos
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Obrigatório:** `householdId` com FK cascade.

## 2. Migration

```bash
pnpm db:generate
pnpm db:migrate
```

## 3. Validators

Arquivo: `/home/flaesh/time-is-money/packages/validators/src/index.ts`

```typescript
export const createBudgetSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().min(1).max(120),
  // ...
});
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
```

## 4. Domain (se houver regra pura)

`/home/flaesh/time-is-money/packages/domain/src/index.ts`

## 5. Application use case

`/home/flaesh/time-is-money/packages/application/src/index.ts`

```typescript
export async function createBudget(ctx: AppContext, raw: CreateBudgetInput) {
  const session = requireSession(ctx.session);
  requireCapability(session, 'settings.write'); // ou nova capability
  const input = createBudgetSchema.parse({ ...raw, householdId: session.householdId });
  // insert + writeAudit
}
```

## 6. Server action

`/home/flaesh/time-is-money/apps/web/src/server/actions.ts`

```typescript
'use server';
export async function createBudgetAction(input: Omit<CreateBudgetInput, 'householdId'>) {
  const ctx = await createAppContext();
  return createBudget(ctx, input as CreateBudgetInput);
}
```

## 7. UI

- Página em `apps/web/src/app/(app)/`
- Link no menu se aplicável

## 8. RBAC

Se entidade sensível, adicionar capability em `@tim/permissions` e atualizar `docs/security/authz-matrix.md`.

## 9. Documentação

- Atualizar `docs/architecture/data-model.md`
- ADR se decisão arquitetural relevante

## Checklist final

- [ ] Filtro `householdId` em todas as queries
- [ ] Sem `any`
- [ ] Audit log em mutações
- [ ] Testes Vitest no domain/use case
