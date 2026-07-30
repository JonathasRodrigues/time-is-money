# Camadas

Separação inspirada em Clean Architecture / SOLID. Dependências fluem **de fora para dentro**.

## Camada 1 — API (`apps/api`)

**Caminho:** `/home/flaesh/time-is-money/apps/api`

- Hono + `@hono/node-server` na porta `3001` (dev)
- Handlers `/api/v1/*` — auth, parse Zod, `@tim/application`
- Clerk: cookie (via rewrite da web) ou Bearer JWT (RN)

## Camada 2 — Apresentação web (`apps/web`)

**Caminho:** `/home/flaesh/time-is-money/apps/web`

Responsabilidades:

- Páginas App Router (`src/app/`)
- Componentes React (`src/components/`)
- Route Handlers REST `/api/v1/*` — Hono (`@tim/api`) embutido via `app/api/v1/[[...route]]` na Vercel; em dev pode haver rewrite para `API_URL` (porta 3001).
- Server actions (`src/server/*.ts`) — bridge legado na web; mutações novas preferir `/api/v1`
- Middleware Clerk, env (`src/env.ts`), cron routes

**Não deve:** conter regras de domínio, SQL direto complexo ou bypass de auth.

Contrato HTTP compartilhado (web + React Native): `@tim/api-contract` — ver [`docs/api/`](../api/README.md).

## Camada 3 — Aplicação (`@tim/application`)

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

## Camada 4 — Domínio (`@tim/domain`)

**Caminho:** `/home/flaesh/time-is-money/packages/domain`

Funções puras, zero I/O:

- `resolveEntities` — matching fuzzy de centro/categoria/conta
- `buildInstallmentSchedule`, `formatBrlFromCents`
- Constantes de seed (`DEFAULT_EXPENSE_CATEGORIES`, aliases)

## Camada 5 — Infraestrutura

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

## Fluxo típico — listar transações (GET)

```
Client (TanStack Query)
  → GET /api/v1/transactions  (browser → @tim/web rewrite)
    → @tim/api (Hono)
      → requireApiContext()
        → loadTransactions(ctx, query)  [@tim/application/queries]
          → @tim/db
```

## Fluxo típico — criar transação (mutação web)

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

| Anti-padrão                 | Correto                                                      |
| --------------------------- | ------------------------------------------------------------ |
| SQL em componente React     | `@tim/application/queries` ou use case em `@tim/application` |
| SQL em `apps/web` loaders   | `@tim/application/queries` — route só faz HTTP               |
| Regra de parcelas na action | `@tim/domain`                                                |
| Capability check só na UI   | `@tim/auth` + `@tim/application`                             |
| Parser CSV na action        | `@tim/imex`                                                  |

## Testes por camada

- **Domain:** Vitest puro (`packages/domain/src/index.test.ts`)
- **Jarvis/Imex:** Vitest com fixtures
- **Application:** mock de `AppContext`
- **Web:** Vitest + Playwright e2e
