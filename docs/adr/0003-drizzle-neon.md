# ADR 0003: Drizzle ORM + Neon PostgreSQL

## Status

Aceito

## Contexto

Precisamos de PostgreSQL relacional, migrations versionadas e driver serverless para Vercel.

## Decisão

- **Drizzle ORM** — schema TypeScript-first em `packages/db`
- **Neon** — PostgreSQL serverless via `@neondatabase/serverless`
- **drizzle-kit** — generate/migrate/studio

Schema: `/home/flaesh/time-is-money/packages/db/src/schema/index.ts`

## Consequências

**Positivas**

- Tipos inferidos das tabelas
- SQL explícito quando necessário
- Branching Neon para preview DB (opcional)

**Negativas**

- Sem ORM-level multi-tenant plugin — filtro manual `household_id`
- Migrations manuais após alteração schema

## Alternativas rejeitadas

- Prisma — bundle maior; Drizzle mais leve para serverless
- SQLite/Turso — relações complexas e concorrência familiar
