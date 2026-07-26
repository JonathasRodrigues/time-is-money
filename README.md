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

Com Postgres local (Docker) e dados mock:

```bash
# sobe Postgres se ainda não estiver
docker start tim-postgres || docker run -d --name tim-postgres \
  -e POSTGRES_USER=tim -e POSTGRES_PASSWORD=tim -e POSTGRES_DB=time_is_money \
  -p 5432:5432 postgres:16-alpine

pnpm db:migrate
pnpm demo:seed          # package @tim/mocks
DEMO_MODE=1 pnpm dev    # ou: pnpm dev:demo
```

Abra `http://localhost:3000` — redireciona ao dashboard com badge **Demo local**.

O package `@tim/mocks` cria household, PF + Empresa X, contas, lançamentos e financiamento de exemplo.

```bash
pnpm dev          # desenvolvimento
pnpm build        # build produção
pnpm lint         # lint
pnpm typecheck    # tipos
pnpm test         # testes unitários
pnpm db:studio    # explorar banco
```

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. **Root Directory:** raiz do monorepo.
3. **Framework:** Next.js — app em `apps/web`.
4. Configure todas as env vars do `.env.example`.
5. Adicione cron job para lembretes (ver `docs/ops/vercel.md`).

Build command sugerido: `pnpm build` (Turbo builda `@tim/web` e dependências).

## Estrutura

```
apps/web/          → Next.js (UI + server actions)
packages/          → domain, application, db, auth, jarvis, imex, email...
docs/              → arquitetura, segurança, playbooks, ADRs
```

Documentação para agentes: [`AGENTS.md`](/home/flaesh/time-is-money/AGENTS.md).

## Licença

Privado — uso interno.
