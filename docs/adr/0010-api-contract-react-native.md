# ADR 0010 — API REST versionada + contrato compartilhado (web + React Native)

## Status

Aceito — 2026-07-28

## Contexto

Server Components com I/O pesado no layout degradam a UX da web. Um app React Native nativo precisa do mesmo backend. Server Actions e RSC não servem o mobile. tRPC acopla demais o client nativo ao runtime Next.

## Decisão

1. REST versionada em `/api/v1/*` — serviço **`@tim/api`** (`apps/api`, Hono).
2. Em **produção (Vercel)** o Hono é embutido no Next (`apps/web/src/app/api/v1/[[...route]]`). Em **dev**, a web pode fazer rewrite de `/api/v1/*` → `API_URL` (ex.: `http://localhost:3001`).
3. Pacote `@tim/api-contract` como **única** fonte de paths, Zod request/response, erros e OpenAPI.
4. Auth: Clerk cookie (web) + Bearer session JWT (RN).
5. Regras de negócio em `@tim/application` / `@tim/domain`; handlers só parseiam e serializam.
6. Política additive-only dentro de v1; breaking → `/api/v2`.
7. Documentação em `docs/api/` + changelog + testes de contrato no CI.
8. Web consome via TanStack Query; RN usará o mesmo contrato (mesma origem Vercel ou `API_URL` standalone).

## Consequências

- Tipagem compartilhada sem duplicar DTOs.
- Mobile pode evoluir sem fork de backend.
- Custo: disciplina de changelog/PR checklist; extrair SQL das pages para application/queries.
