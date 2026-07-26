# ADR 0001: Monorepo com Turborepo

## Status

Aceito

## Contexto

Time is Money combina app web, lógica de domínio, integrações (email, imex, jarvis) e schema DB. Precisamos de builds incrementais, tipagem compartilhada e deploy único.

## Decisão

Adotar **pnpm workspaces + Turborepo**:

- Raiz: `/home/flaesh/time-is-money`
- App: `apps/web` (`@tim/web`)
- Pacotes: `packages/*` (`@tim/*`)
- Orquestração via `turbo.json` (build, lint, typecheck, test)

## Consequências

**Positivas**

- Cache de build Turbo
- Imports tipados entre pacotes (`workspace:*`)
- CI único na raiz

**Negativas**

- Curva inicial de config (`transpilePackages` no Next)
- Migrations centralizadas em `@tim/db`

## Alternativas rejeitadas

- Repo separado front/back — overhead desnecessário para escopo familiar
- Nx — Turbo mais simples para stack Next-only
