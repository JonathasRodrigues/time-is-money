# AGENTS.md — Time is Money

Ponto de entrada para agentes de IA. Leia este arquivo antes de qualquer alteração no monorepo.

## Ordem de leitura

1. `/home/flaesh/time-is-money/AGENTS.md` (este arquivo)
2. `/home/flaesh/time-is-money/docs/architecture/overview.md`
3. `/home/flaesh/time-is-money/docs/architecture/layers.md`
4. `/home/flaesh/time-is-money/docs/security/authz-matrix.md`
5. Playbook específico em `/home/flaesh/time-is-money/docs/playbooks/`
6. ADR relevante em `/home/flaesh/time-is-money/docs/adr/`

## Comandos (raiz do monorepo)

| Comando             | Descrição                            |
| ------------------- | ------------------------------------ |
| `pnpm install`      | Instala dependências do workspace    |
| `pnpm dev`          | Sobe `@tim/web` (Next.js, Turbopack) |
| `pnpm build`        | Build de todos os pacotes via Turbo  |
| `pnpm lint`         | ESLint/tsc lint em todos os pacotes  |
| `pnpm typecheck`    | Verificação de tipos                 |
| `pnpm test`         | Vitest em todos os pacotes           |
| `pnpm test:e2e`     | Playwright em `@tim/web`             |
| `pnpm db:generate`  | Gera migrations Drizzle              |
| `pnpm db:migrate`   | Aplica migrations no Neon            |
| `pnpm db:studio`    | Drizzle Studio                       |
| `pnpm format`       | Prettier write                       |
| `pnpm format:check` | Prettier check                       |

**Requisitos:** Node ≥ 22, pnpm 9 (`packageManager` em `package.json`).

## Mapa de pacotes

| Pacote             | Caminho                                           | Responsabilidade                                          |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------- |
| `@tim/web`         | `/home/flaesh/time-is-money/apps/web`             | App Next.js 15, UI, server actions, rotas API/cron        |
| `@tim/application` | `/home/flaesh/time-is-money/packages/application` | Casos de uso (transações, financiamentos, audit)          |
| `@tim/domain`      | `/home/flaesh/time-is-money/packages/domain`      | Regras puras, resolução de entidades, seeds de categorias |
| `@tim/db`          | `/home/flaesh/time-is-money/packages/db`          | Drizzle schema, Neon client, migrations, seed             |
| `@tim/auth`        | `/home/flaesh/time-is-money/packages/auth`        | Sessão, MFA, capabilities                                 |
| `@tim/permissions` | `/home/flaesh/time-is-money/packages/permissions` | RBAC (admin/editor/viewer)                                |
| `@tim/validators`  | `/home/flaesh/time-is-money/packages/validators`  | Schemas Zod de entrada                                    |
| `@tim/crypto`      | `/home/flaesh/time-is-money/packages/crypto`      | AES-256-GCM por household                                 |
| `@tim/jarvis`      | `/home/flaesh/time-is-money/packages/jarvis`      | Intents, parser heurístico, prompt LLM                    |
| `@tim/imex`        | `/home/flaesh/time-is-money/packages/imex`        | Import/export CSV/XLSX                                    |
| `@tim/email`       | `/home/flaesh/time-is-money/packages/email`       | Templates React Email + Resend                            |
| `@tim/ui`          | `/home/flaesh/time-is-money/packages/ui`          | Componentes compartilhados                                |
| `@tim/config`      | `/home/flaesh/time-is-money/packages/config`      | Configs compartilhadas (ESLint, TS)                       |

## Regras obrigatórias

### Tipagem

- **Nunca usar `any`.** Tipos explícitos ou inferência segura.
- Validar entradas externas com Zod (`@tim/validators`).

### Arquitetura (SOLID)

- **Domain** (`@tim/domain`): funções puras, sem I/O.
- **Application** (`@tim/application`): orquestra DB + auth + audit.
- **Web** (`apps/web`): apenas UI, server actions finas e wiring.
- Dependências apontam para dentro: web → application → domain.

### Multi-tenancy (`household_id`)

- Toda query de dados do usuário **deve** filtrar por `householdId` da sessão.
- Nunca confiar em `householdId` vindo do cliente sem validar contra a sessão.
- Inserções usam `session.householdId`, nunca um ID arbitrário do payload.

### Segurança

- MFA obrigatório via Clerk (`requireSession` em `@tim/auth`).
- Verificar capability antes de mutações (`requireCapability`).
- Campos sensíveis (ex.: `notes`) criptografados com `@tim/crypto`.
- Cron protegido por `CRON_SECRET` (Bearer token).

### Integrações — o que NÃO fazer

- **Nunca inventar APIs bancárias.** Não há Open Banking integrado.
- Lançamentos são manuais, import CSV/XLSX ou via Jarvis.
- Não assumir sincronização com bancos, cartões ou corretoras.

### Jarvis

- Intents discriminados em `@tim/jarvis` (`jarvisIntentSchema`).
- Nunca inventar categorias/contas/centros — resolver contra contexto do household.
- Mutações exigem capability `jarvis.mutate`.

### Import/Export

- Parsing em `@tim/imex`; persistência via server actions em `imex-actions.ts`.
- Formato padrão: cabeçalhos PT (`data`, `valor`, `tipo`, etc.).

## Onde colocar código novo

| Tarefa                   | Local                                                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| Nova entidade de domínio | `packages/domain`, schema em `packages/db`, use case em `packages/application` |
| Nova server action       | `apps/web/src/server/`                                                         |
| Novo widget dashboard    | `apps/web/src/app/(app)/dashboard/` + `components/charts.tsx`                  |
| Nova intent Jarvis       | `packages/jarvis/src/index.ts` + playbook                                      |
| Novo alerta email        | `packages/email` + rota cron em `apps/web/src/app/api/cron/`                   |

## Variáveis de ambiente

Ver `/home/flaesh/time-is-money/.env.example`. Copiar para `.env.local` em `apps/web`.
