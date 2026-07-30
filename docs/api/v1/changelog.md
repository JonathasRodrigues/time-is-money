# Changelog — API v1

Formato [Keep a Changelog](https://keepachangelog.com/). Versão = `API_CONTRACT_VERSION` em `@tim/api-contract`.

## [1.3.2] — 2026-07-29

### Added

- **Dashboard `planning`:** snapshot de metas (progresso, restante, aporte mensal necessário, próximo prazo)

## [1.3.1] — 2026-07-29

### Changed

- **Dashboard `cashRadar`:** horizonte alinhado ao período do filtro (`active`, `horizonStart`, `horizonLabel`); inativo em períodos só no passado

## [1.3.0] — 2026-07-29

### Added

- **Dashboard:** `cashRadar` — liquidez vs obrigações (faturas, a pagar, financiamentos) no horizonte de 14 dias + snapshot de cartões
- **Dashboard:** `paymentMix` — despesas do período por canal (conta à vista vs cartão de crédito)

## [1.2.0] — 2026-07-28

### Added

- **Família:** convites (`POST/DELETE /members/invites`), papel e remoção de membros, aceitar convite (`POST /invites/accept`, `/invites/accept-by-id`)
- **Import/Export:** template CSV, export, preview multipart, editar preview, commit
- **Jarvis:** `POST /jarvis/messages`
- Casos de uso em `@tim/application` (`imex/use-cases`, `jarvis/chat`)
- Web migra `members-actions`, `imex-actions` e `jarvis-actions` para `apps/web/src/lib/api/mutations.ts`

### Notes

- Upload de import usa `multipart/form-data` (`apiFetchForm` na web).
- E-mail de convite via Resend quando `RESEND_*` estão configurados em `@tim/api`.

## [1.1.0] — 2026-07-28

### Added

- Mutações REST em `@tim/api` (POST/PATCH/PUT/DELETE) para React Native e clientes HTTP
- Transações: criar, editar, excluir, pagar (unitário e bulk), série mensal, pendente
- Contas: instituições, contas, cartões, transferências, saldo
- Financiamentos: criar, pagar parcela(s), rebuild, excluir
- Planejamento: CRUD de planos, itens e contribuições
- Settings: centros de custo, categorias
- Preferências e income prompt (confirm, confirm-item, snooze)
- Onboarding: `POST /api/v1/households`
- Comandos extraídos para `@tim/application/commands`

### Notes

- Web usa `apps/web/src/lib/api/mutations.ts` (REST) + TanStack Query; `server/actions.ts` removido.

## [1.0.0] — 2026-07-28

### Added

- Envelope de erro padronizado (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `NO_HOUSEHOLD`, `INTERNAL`)
- `GET /api/v1/me`
- `GET /api/v1/bootstrap`
- `GET /api/v1/income-prompt` (sem side-effects)
- `GET /api/v1/dashboard`
- `GET /api/v1/payments`
- `GET /api/v1/transactions`
- `GET /api/v1/wealth`
- `GET /api/v1/financings`
- `GET /api/v1/planning`
- `GET /api/v1/accounts`
- `GET /api/v1/categories`
- `GET /api/v1/cost-centers`
- `GET /api/v1/preferences`
- `GET /api/v1/members`
- `POST /api/v1/payments/ensure-instances`
- `GET /api/v1/openapi.json`
- Pacote `@tim/api-contract` (paths, Zod, OpenAPI)
- Auth dual: cookie Clerk (web) + Bearer JWT (React Native)

### Notes

- Mutações na web continuam via Server Actions até migração para `api.*` (endpoints REST já disponíveis para RN).
- Cache da web é gerenciado pelo TanStack Query; server actions não usam `revalidatePath`.
