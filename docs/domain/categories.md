# Categorias

Sistema hierárquico de classificação de lançamentos.

## Schema

- Tabela `categories`: `name`, `type` (`income`|`expense`), `parent_id`, `is_system`, `is_archived`
- Tabela `category_aliases`: sinônimos para resolução fuzzy

## Seed padrão

Definido em `/home/flaesh/time-is-money/packages/domain/src/index.ts`, aplicado por `seedHouseholdDefaults` em `/home/flaesh/time-is-money/packages/db/src/seed.ts`.

### Despesas (com filhos)

| Pai            | Filhos                 |
| -------------- | ---------------------- |
| Moradia        | —                      |
| Alimentação    | Supermercado, Delivery |
| Transporte     | —                      |
| Saúde          | —                      |
| Educação       | —                      |
| Lazer          | —                      |
| Assinaturas    | —                      |
| Impostos/Taxas | —                      |
| Pessoal        | —                      |
| Outros         | —                      |

### Receitas

Salário, Freelance, Rendimentos, Reembolso, Outros.

### Aliases padrão

| Categoria    | Aliases                         |
| ------------ | ------------------------------- |
| Supermercado | mercado, super, compras         |
| Delivery     | ifood, delivery, rappi          |
| Transporte   | uber, 99, combustivel, gasolina |
| Moradia      | aluguel, condominio             |

## Regras de negócio

- Categorias `is_system: true` vêm do seed — evitar deletar em produção.
- Usuário pode criar categorias custom (`is_system: false`).
- Tipo da categoria deve bater com tipo do lançamento (expense ↔ despesa).
- Arquivar (`is_archived`) em vez de deletar se houver lançamentos históricos.

## Resolução (Jarvis / Import)

`resolveEntities` em `@tim/domain` faz match por nome ou alias (score ≥ 80). Ambiguidade retorna opções para clarificação.

## UI

Gerenciamento em `/settings/categories`.

## Adicionar categoria seed

Ver playbook: `docs/playbooks/add-seed-category.md`.
