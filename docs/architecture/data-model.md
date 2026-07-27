# Modelo de dados

Schema Drizzle em `/home/flaesh/time-is-money/packages/db/src/schema/index.ts`. PostgreSQL no Neon.

## Entidades centrais

### households

Grupo financeiro (família). Opcionalmente ligado a `clerk_org_id`.

### memberships

Vínculo usuário ↔ household. Campos: `user_id` (Clerk), `email`, `role` (`admin` | `editor` | `viewer`).

### cost_centers

Centros de custo (ex.: Pessoa Física, Empresa). `is_system`, `is_archived`.

### categories

Categorias hierárquicas (`parent_id`). Tipo: `income` | `expense`. Aliases em `category_aliases`.

### accounts

Contas vinculadas a um `cost_center_id` (ex.: Carteira / Dinheiro).

### transactions

Lançamentos financeiros.

| Campo             | Tipo        | Notas                                     |
| ----------------- | ----------- | ----------------------------------------- |
| `amount_cents`    | integer     | Valores em centavos                       |
| `occurred_on`     | varchar(10) | ISO date `YYYY-MM-DD`                     |
| `notes_encrypted` | text        | AES-256-GCM                               |
| `source`          | varchar     | `manual`, `import`, `jarvis`, `financing` |
| `duplicate_hash`  | varchar(64) | Dedup na importação                       |
| `deleted_at`      | timestamp   | Soft delete                               |

### financings + installments

Financiamentos com cronograma de parcelas.

- `installment_status`: `pending` | `paid` | `skipped`
- `financing_category`: `real_estate` | `vehicle` | `personal` | `other`
- Parcela paga gera `transaction` e referencia `transaction_id`

### plans + plan_items

Metas de planejamento (viagens, quitação, custom).

- `plan_kind`: `travel` | `financing_payoff` | `custom`
- Meta total = soma de `plan_items.amount_cents`
- `linked_account_id` → caixinha (`investment_pot`) para progresso
- `financing_id` opcional (obrigatório em `financing_payoff`)
- `monthly_target_cents` — aporte mensal da estratégia
- `plan_contributions` — cronograma mensal (`due_on`, `amount_cents`, `sort_order`)

Ver [`docs/domain/planning.md`](../domain/planning.md).

## Jarvis

- `jarvis_threads` — conversas por usuário/household
- `jarvis_messages` — mensagens com `intent` JSONB

## Import/Export

- `import_jobs` + `import_job_rows` — pipeline com preview
- `export_jobs` — auditoria de exportações

## Preferências e notificações

- `user_preferences` — defaults, janelas de lembrete, TTS
- `notification_outbox` — dedup de emails enviados (unique por user/kind/ref/window/sent_on)

## Audit

- `audit_logs` — ações com `resource_type`, `metadata` JSONB

## Enums

```
member_role: admin | editor | viewer
transaction_type: income | expense
installment_status: pending | paid | skipped
import_status: pending | preview | processing | completed | failed
message_role: user | assistant | system
message_source: text | voice
```

## Regra de ouro

**Toda tabela de negócio tem `household_id`.** Queries sem esse filtro são bug de segurança.

## Diagrama ER (simplificado)

```mermaid
erDiagram
  households ||--o{ memberships : has
  households ||--o{ cost_centers : has
  households ||--o{ categories : has
  households ||--o{ accounts : has
  households ||--o{ transactions : has
  households ||--o{ financings : has
  cost_centers ||--o{ accounts : contains
  categories ||--o{ category_aliases : has
  financings ||--o{ installments : has
  plans ||--o{ plan_items : has
  plans }o--o| accounts : saves_in
  plans }o--o| financings : payoff_for
  installments }o--o| transactions : pays_via
  categories ||--o{ transactions : categorizes
  accounts ||--o{ transactions : books
```

## Migrations

```bash
pnpm db:generate   # após alterar schema
pnpm db:migrate    # aplicar
```

Config Drizzle: `packages/db/drizzle.config.ts`.
