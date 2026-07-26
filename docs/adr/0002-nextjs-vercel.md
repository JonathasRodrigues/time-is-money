# ADR 0002: Next.js na Vercel

## Status

Aceito

## Contexto

UI rica, SSR, server actions, PWA e cron jobs no mesmo deploy.

## Decisão

- **Next.js 15** App Router em `apps/web`
- Deploy na **Vercel** (região próxima ao Neon)
- Server Actions para mutações (sem API REST separada)
- Cron via Vercel Cron → rotas `/api/cron/*`

## Consequências

**Positivas**

- DX integrada Clerk + Next
- Edge middleware para auth
- Preview deployments por PR

**Negativas**

- Vendor lock-in moderado na hosting
- Limites serverless (timeout, body 4MB)

## Alternativas rejeitadas

- SPA + API Express — duplicaria auth e deploy
- Remix/Fly — time familiar com Next
