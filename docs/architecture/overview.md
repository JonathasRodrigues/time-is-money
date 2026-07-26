# Visão geral da arquitetura

Time is Money é um monorepo **pnpm + Turborepo** com uma aplicação Next.js 15 e pacotes de domínio desacoplados.

## Stack

| Camada        | Tecnologia                                                 |
| ------------- | ---------------------------------------------------------- |
| Frontend      | Next.js 15 (App Router), React 19, Tailwind 4, Recharts    |
| Auth          | Clerk (MFA opcional — Pro)                                 |
| Banco         | PostgreSQL (Neon serverless) + Drizzle ORM                 |
| Email         | Resend + React Email                                       |
| Chat          | Jarvis (`@tim/jarvis`) — heurístico ou OpenAI              |
| Import/Export | CSV/XLSX via SheetJS (`@tim/imex`)                         |
| Deploy        | Vercel                                                     |
| PWA           | `manifest.webmanifest`, ícones em `apps/web/public/icons/` |

## Fluxo de request

```
Browser → Clerk middleware → Server Component / Server Action
         → createAppContext() → @tim/application → @tim/db (Neon)
```

1. `apps/web/src/middleware.ts` protege rotas com Clerk.
2. Server actions em `apps/web/src/server/` montam `AppContext` (DB + sessão + encryption secret).
3. Casos de uso em `@tim/application` validam auth/RBAC e executam queries com filtro `householdId`.
4. Resposta renderizada no cliente ou retorno JSON/base64 (export).

## Multi-tenancy

Unidade de isolamento: **household** (família/grupo financeiro).

- Usuário Clerk → `memberships` → `householdId` + `role`.
- Todas as tabelas de negócio carregam `household_id`.
- Onboarding cria household + seed de categorias/centros (`seedHouseholdDefaults`).

## RBAC

Três papéis: `admin`, `editor`, `viewer`. Capabilities em `@tim/permissions`. Matriz completa: `docs/security/authz-matrix.md`.

## Módulos principais

| Módulo         | Rota                      | Pacotes                 |
| -------------- | ------------------------- | ----------------------- |
| Dashboard      | `/dashboard`              | web, db                 |
| Transações     | `/transactions`           | application, validators |
| Financiamentos | `/financings`             | application, domain     |
| Jarvis         | `/jarvis` + FAB           | jarvis, application     |
| Import/Export  | `/import-export`          | imex, application       |
| Settings       | `/settings/*`             | web, db                 |
| Cron lembretes | `/api/cron/due-reminders` | email, db               |

## O que o sistema NÃO faz

- **Sem integração bancária.** Lançamentos manuais, CSV/XLSX ou Jarvis.
- Sem sync automático com cartões ou investimentos externos.

## Diagrama

```mermaid
flowchart TB
  subgraph client [Cliente]
    PWA[PWA / Browser]
  end
  subgraph vercel [Vercel]
    Next[Next.js @tim/web]
    Cron[Cron due-reminders]
  end
  subgraph packages [Pacotes]
    App[@tim/application]
    Dom[@tim/domain]
    Jrv[@tim/jarvis]
    Imx[@tim/imex]
  end
  subgraph external [Externos]
    Clerk[Clerk MFA]
    Neon[(Neon PG)]
    Resend[Resend]
    OpenAI[OpenAI opcional]
  end
  PWA --> Next
  Next --> Clerk
  Next --> App
  App --> Dom
  Next --> Jrv
  Next --> Imx
  App --> Neon
  Cron --> Resend
  Cron --> Neon
  Jrv -.-> OpenAI
```
