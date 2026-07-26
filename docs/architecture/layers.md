# Camadas

Separação inspirada em Clean Architecture / SOLID. Dependências fluem **de fora para dentro**.

## Camada 1 — Apresentação (`apps/web`)

**Caminho:** `/home/flaesh/time-is-money/apps/web`

Responsabilidades:

- Páginas App Router (`src/app/`)
- Componentes React (`src/components/`)
- Server actions (`src/server/*.ts`) — finas, sem lógica de negócio pesada
- Middleware Clerk, env (`src/env.ts`), cron routes

**Não deve:** conter regras de domínio, SQL direto complexo ou bypass de auth.

## Camada 2 — Aplicação (`@tim/application`)

**Caminho:** `/home/flaesh/time-is-money/packages/application`

Casos de uso transacionais:

- `createTransaction`, `createFinancing`, `payInstallmentWithCategory`
- `writeAudit`
- Recebe `AppContext { db, session, encryptionSecret }`

**Regras:**

- Sempre `requireSession` + `requireCapability` antes de mutação
- Valida input com schemas de `@tim/validators`
- Criptografa campos sensíveis via `@tim/crypto`
- Grava audit log

## Camada 3 — Domínio (`@tim/domain`)

**Caminho:** `/home/flaesh/time-is-money/packages/domain`

Funções puras, zero I/O:

- `resolveEntities` — matching fuzzy de centro/categoria/conta
- `buildInstallmentSchedule`, `formatBrlFromCents`
- Constantes de seed (`DEFAULT_EXPENSE_CATEGORIES`, aliases)

## Camada 4 — Infraestrutura

| Pacote             | Função                                        |
| ------------------ | --------------------------------------------- |
| `@tim/db`          | Schema Drizzle, client Neon, migrations, seed |
| `@tim/auth`        | Tipos de sessão, guards MFA/forbidden         |
| `@tim/permissions` | RBAC capabilities                             |
| `@tim/crypto`      | AES-256-GCM por household                     |
| `@tim/email`       | Resend + templates                            |
| `@tim/imex`        | Parse/serialize CSV/XLSX                      |
| `@tim/jarvis`      | Intents e resolução contra contexto           |
| `@tim/validators`  | Zod schemas                                   |
| `@tim/ui`          | Design system mínimo                          |

## Fluxo típico — criar transação

```
UI form
  → server action (actions.ts)
    → createAppContext()
      → createTransaction(ctx, input)  [@tim/application]
        → createTransactionSchema.parse  [@tim/validators]
        → requireCapability('transactions.write')
        → encryptSensitiveField(notes)   [@tim/crypto]
        → db.insert(transactions)        [@tim/db]
        → writeAudit()
```

## Onde NÃO colocar código

| Anti-padrão                 | Correto                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| SQL em componente React     | `@tim/application` ou query em Server Component com filtro household |
| Regra de parcelas na action | `@tim/domain`                                                        |
| Capability check só na UI   | `@tim/auth` + `@tim/application`                                     |
| Parser CSV na action        | `@tim/imex`                                                          |

## Testes por camada

- **Domain:** Vitest puro (`packages/domain/src/index.test.ts`)
- **Jarvis/Imex:** Vitest com fixtures
- **Application:** mock de `AppContext`
- **Web:** Vitest + Playwright e2e
