# Deploy — produção (Vercel + Neon)

Um único projeto Vercel: Next.js embute o Hono em `/api/v1`. Detalhes: [`vercel.md`](./vercel.md).

## Arquitetura em prod

```
Browser → Vercel (@tim/web + Hono /api/v1)
              │
              ▼
           Neon Postgres
```

Cron (`/api/cron/due-reminders`) na mesma Vercel.

> Dev local ainda pode subir `@tim/api` separado (`API_URL=http://localhost:3001`). Em produção **não** defina `API_URL` — a rota Next `app/api/v1/[[...route]]` atende o contrato.

---

## 1. Neon (banco)

**Não precisa refazer** se o projeto Neon já existe — só aplicar schema.

### Opção A (preferida) — migrate via CLI

```bash
DATABASE_URL='postgresql://...@...neon.tech/neondb?sslmode=require' pnpm db:migrate
```

### Opção B — SQL Editor (banco **vazio** ou **reconstruir do zero**)

1. Neon Console → SQL Editor
2. Colar o arquivo **inteiro** `packages/db/drizzle/rebuild-neon.sql` (apaga o schema e recria 0000→0014)
3. Run uma vez
4. **Não** rode `pnpm db:migrate` depois
5. No app: login → onboarding (cria household + categorias)

> Se o paste anterior parou no meio, a base fica inconsistente (ex.: falta `accounts.institution_id`). Use `rebuild-neon.sql`, não pedaços.

### Banco já existente (só faltam cartões / planning)

`pnpm db:migrate` ou `packages/db/drizzle/upgrade-delta.sql`.

---

## 2. Secrets

| Variável              | Como                                  |
| --------------------- | ------------------------------------- |
| `DATABASE_URL`        | Connection string Neon                |
| `ENCRYPTION_SECRET`   | `openssl rand -base64 32` (≥16 chars) |
| `CRON_SECRET`         | `openssl rand -hex 32`                |
| Clerk keys            | Dashboard Clerk                       |
| `RESEND_*`            | Resend                                |
| `OPENAI_API_KEY`      | Opcional (Jarvis)                     |
| `NEXT_PUBLIC_APP_URL` | `https://seu-app.vercel.app`          |

**Não** defina em produção: `API_URL`, `DEMO_MODE`, `MOCK_API`, `NEXT_PUBLIC_MOCK_API`.

---

## 3. Web + API — Vercel (um projeto)

1. Importar o repositório
2. **Root Directory:** `apps/web` (obrigatório)
3. Framework: Next.js · Node 22
4. Env vars (Production + Preview) — tabela acima
5. Deploy
6. Clerk → Allowed origins: URL Vercel

Smoke:

```bash
curl https://seu-app.vercel.app/api/health
# → {"ok":true,"service":"@tim/api"}

curl https://seu-app.vercel.app/api/v1/...   # com sessão Clerk / Bearer
```

Cron: `apps/web/vercel.json` (`0 11 * * *` → `/api/cron/due-reminders`).

---

## 4. Smoke test

1. Abrir `NEXT_PUBLIC_APP_URL` → sign-in Clerk
2. Onboarding → criar household
3. Dashboard carrega (`/api/v1/...`)
4. Criar uma conta / lançamento
5. (Opcional) `curl -H "Authorization: Bearer $CRON_SECRET" https://seu-app.vercel.app/api/cron/due-reminders`

---

## Ordem sugerida

1. Neon + migrate/bootstrap
2. Secrets gerados
3. Deploy Vercel (sem `API_URL`)
4. Clerk domains
5. Smoke test

---

## Opcional — API standalone (Docker / Fly)

Só se precisar escalar a API fora do Next (ex.: RN com carga alta). Ver `Dockerfile.api` + `fly.toml`, e aí sim defina `API_URL` na Vercel apontando para esse host.
