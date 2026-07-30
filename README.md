# Time is Money

Finanças domésticas compartilhadas — monorepo pnpm com Next.js, Drizzle/Neon, Clerk (MFA), Resend, Jarvis (chat), import/export CSV/XLSX e PWA.

## Pré-requisitos

- **Node.js** ≥ 22
- **pnpm** 9 (`corepack enable && corepack prepare pnpm@9.15.9 --activate`)
- Contas: [Clerk](https://clerk.com), [Neon](https://neon.tech), [Resend](https://resend.com) (opcional: OpenAI para Jarvis)

## Setup local

```bash
git clone <repo-url> time-is-money
cd time-is-money
pnpm install
cp .env.example apps/web/.env.local
# Preencher variáveis (ver abaixo)
pnpm db:migrate
pnpm dev
```

App em `http://localhost:3000`.

## Variáveis de ambiente

Copie `/home/flaesh/time-is-money/.env.example` para `apps/web/.env.local`:

| Variável                            | Serviço     | Descrição                                       |
| ----------------------------------- | ----------- | ----------------------------------------------- |
| `DATABASE_URL`                      | Neon        | Connection string PostgreSQL                    |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk       | Chave pública                                   |
| `CLERK_SECRET_KEY`                  | Clerk       | Chave secreta                                   |
| `ENCRYPTION_SECRET`                 | App         | Segredo para AES-256-GCM (≥ 32 chars)           |
| `CRON_SECRET`                       | Vercel Cron | Token Bearer para `/api/cron/*`                 |
| `RESEND_API_KEY`                    | Resend      | Envio de emails                                 |
| `RESEND_FROM_EMAIL`                 | Resend      | Remetente verificado                            |
| `OPENAI_API_KEY`                    | OpenAI      | Opcional — Jarvis usa parser heurístico sem ela |
| `NEXT_PUBLIC_APP_URL`               | App         | URL base (ex.: `http://localhost:3000`)         |

### Clerk

1. Crie aplicação em [Clerk Dashboard](https://dashboard.clerk.com).
2. Ative **Multi-factor authentication** (obrigatório no app).
3. Configure URLs: sign-in `/sign-in`, sign-up `/sign-up`, redirect pós-login `/dashboard`.
4. Copie publishable e secret keys para `.env.local`.

### Neon

1. Crie projeto PostgreSQL em [Neon Console](https://console.neon.tech).
2. Copie a connection string para `DATABASE_URL`.
3. Rode `pnpm db:migrate` na raiz.

### Resend

1. Crie API key em [Resend](https://resend.com/api-keys).
2. Verifique domínio ou use `onboarding@resend.dev` em dev.
3. Configure `RESEND_FROM_EMAIL` e `RESEND_API_KEY`.

## Demo local (sem Clerk)

Com `DEMO_MODE=1` o Clerk é **ignorado** mesmo se houver chaves no `.env`. Sessão e dados vêm do mock (`@tim/mocks`).

```bash
# sobe Postgres se ainda não estiver
docker start tim-postgres || docker run -d --name tim-postgres \
  -e POSTGRES_USER=tim -e POSTGRES_PASSWORD=tim -e POSTGRES_DB=time_is_money \
  -p 5432:5432 postgres:16-alpine

pnpm db:migrate
pnpm dev:demo           # seed + DEMO_MODE=1 + next dev
# ou, se o seed já rodou e DEMO_MODE=1 está no .env.local:
pnpm dev
```

Abra `http://localhost:3000/dashboard` — badge **Demo local**.

Para testar Clerk de verdade: `pnpm dev:clerk` (exige chaves válidas e `DEMO_MODE=0`).

## UI mock offline (sem API nem banco)

Com `MOCK_API=1` a web responde com fixtures in-memory em `@tim/mocks/api` — ideal para Storybook, protótipos e testes de UI.

```bash
pnpm dev:mock    # só @tim/web — sem @tim/api, Neon ou Clerk
```

Abra `http://localhost:3000/dashboard`. Mutações simples (ex.: criar lançamento) atualizam o store em memória na sessão.

O package `@tim/mocks` também faz seed no Postgres para `dev:demo` (household, PF + Empresa X, contas, lançamentos e financiamento de exemplo).

```bash
pnpm dev          # desenvolvimento (respeita DEMO_MODE do .env)
pnpm build        # build produção
pnpm lint         # lint
pnpm typecheck    # tipos
pnpm test         # testes unitários
pnpm db:studio    # explorar banco
```

## Deploy (produção)

Checklist: [`docs/ops/deploy.md`](docs/ops/deploy.md).

1. **Neon** — `DATABASE_URL=<prod> pnpm db:migrate` (ou `packages/db/drizzle/bootstrap-neon.sql` num banco vazio).
2. **Vercel** — Root Directory `apps/web`, env vars do `.env.example` **sem** `API_URL` (Hono embutido em `/api/v1`).
3. Clerk: domínio Vercel nas allowed origins.
4. Cron: `apps/web/vercel.json` (ver `docs/ops/vercel.md`).

## Estrutura

```
apps/web/          → Next.js (UI + server actions)
packages/          → domain, application, db, auth, jarvis, imex, email...
docs/              → arquitetura, segurança, playbooks, ADRs
```

Documentação para agentes: [`AGENTS.md`](/home/flaesh/time-is-money/AGENTS.md).

## Licença

Privado — uso interno.
