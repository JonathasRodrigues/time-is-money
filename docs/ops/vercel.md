# Operações — Vercel

Deploy e configuração em produção.

## Projeto

| Setting        | Valor                              |
| -------------- | ---------------------------------- |
| Framework      | Next.js                            |
| Root Directory | `/` (monorepo root)                |
| App path       | `apps/web`                         |
| Install        | `pnpm install`                     |
| Build          | `pnpm build`                       |
| Output         | Next default (`.next` em apps/web) |

## Node

Versão **22** — alinhada a `engines` em `package.json`.

## Variáveis de ambiente

Copiar todas de `.env.example` para Vercel (Production + Preview):

- `DATABASE_URL` — Neon production (preview pode usar branch Neon)
- `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`
- `ENCRYPTION_SECRET`, `CRON_SECRET`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `OPENAI_API_KEY` (opcional)
- `NEXT_PUBLIC_APP_URL` — URL Vercel production

## Cron Jobs

Exemplo `vercel.json` na raiz ou config dashboard:

```json
{
  "crons": [
    {
      "path": "/api/cron/due-reminders",
      "schedule": "0 12 * * *"
    }
  ]
}
```

Rota exige header:

```
Authorization: Bearer <CRON_SECRET>
```

Implementação: `apps/web/src/app/api/cron/due-reminders/route.ts`

## Migrations

Rodar antes ou após deploy:

```bash
DATABASE_URL=<prod> pnpm db:migrate
```

Ou CI step dedicado (não auto na Vercel build por padrão).

## PWA

- `apps/web/public/manifest.webmanifest`
- Ícones: `public/icons/icon-192.png`, `icon-512.png`
- `start_url`: `/dashboard`

## Domínios Clerk

Adicionar domínio Vercel nas allowed origins do Clerk Dashboard.

## Preview PRs

- Env vars de Preview no Vercel
- Neon branch database recomendado
- Clerk keys de dev/staging

## Monitoramento

- Vercel Analytics (opcional)
- Logs: Vercel Functions → cron e server actions
- Resend dashboard para deliverability

## Rollback

Revert deploy na Vercel; migrations são forward-only — planejar down migrations manualmente se necessário.
