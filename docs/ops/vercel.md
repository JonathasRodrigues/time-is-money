# Operações — Vercel

Deploy único: **web + API Hono** no mesmo projeto (`@tim/web`). Checklist: [`deploy.md`](./deploy.md).

## Projeto

| Setting        | Valor                                                   |
| -------------- | ------------------------------------------------------- |
| Framework      | Next.js                                                 |
| Root Directory | `apps/web` (obrigatório — senão deploy dá 404)          |
| App path       | `apps/web`                                              |
| Install        | `cd ../.. && pnpm install` (via `apps/web/vercel.json`) |
| Build          | `cd ../.. && pnpm turbo run build --filter=@tim/web`    |
| Output         | Next default (`.next` em apps/web)                      |

> Se o Root Directory ficar na raiz do monorepo, o build do Turbo passa mas a Vercel não encontra as rotas Next → `NOT_FOUND` / 404.

## Node

Versão **22** — alinhada a `engines` em `package.json`.

## API no mesmo deploy

`@tim/api` (Hono) é montado em:

`apps/web/src/app/api/v1/[[...route]]/route.ts`

Health: `/api/health`.

Em produção **não** defina `API_URL`. Se `API_URL` estiver setado, o Next faz rewrite/proxy para esse origin (útil no dev local com processo na porta 3001).

## Variáveis de ambiente

| Var                                       | Notas                                                 |
| ----------------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`                            | Neon production (preview pode usar branch Neon)       |
| `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY` | Clerk                                                 |
| `ENCRYPTION_SECRET`, `CRON_SECRET`        | Secrets próprios                                      |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`     | Email                                                 |
| `OPENAI_API_KEY`                          | Opcional (Jarvis)                                     |
| `NEXT_PUBLIC_APP_URL`                     | URL Vercel production                                 |
| `API_URL`                                 | **Só local / API standalone** — omitir em prod Vercel |

Não definir `MOCK_API` / `DEMO_MODE` em produção.

## Cron Jobs

Configurado em `apps/web/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/due-reminders",
      "schedule": "0 11 * * *"
    }
  ]
}
```

Rota exige header:

```
Authorization: Bearer <CRON_SECRET>
```

## Migrations

```bash
DATABASE_URL=<prod> pnpm db:migrate
```

Banco vazio via SQL Editor: `packages/db/drizzle/bootstrap-neon.sql`.

## Domínios Clerk

Adicionar domínio Vercel nas allowed origins do Clerk Dashboard.

## Preview PRs

- Env vars de Preview no Vercel
- Neon branch database recomendado
- Clerk keys de dev/staging
- Sem `API_URL` (API embutida)

## Monitoramento

- Vercel Analytics (opcional)
- Logs: Vercel Functions → `/api/v1` e cron
- Resend dashboard para deliverability

## Rollback

Revert deploy na Vercel; migrations são forward-only.
