# Import / Export (IMEX)

Pacote: `/home/flaesh/time-is-money/packages/imex`  
Server actions: `/home/flaesh/time-is-money/apps/web/src/server/imex-actions.ts`  
UI: `/import-export`

## Formatos suportados

- **CSV** — delimitador `;` ou `,` (auto-detect)
- **XLSX** — primeira aba da planilha

## Template de colunas

| Coluna         | Obrigatório | Exemplo                      |
| -------------- | :---------: | ---------------------------- |
| `data`         |      ✓      | `2026-07-01` ou `01/07/2026` |
| `valor`        |      ✓      | `100,00` ou `R$ 100,00`      |
| `tipo`         |             | `despesa` / `receita`        |
| `descricao`    |             | Supermercado                 |
| `categoria`    |             | Supermercado                 |
| `centro_custo` |             | Pessoa Física                |
| `conta`        |             | Carteira / Dinheiro          |

Baixar template: `downloadTemplateAction()`.

## Pipeline de importação

1. Upload → `parseSpreadsheet` (SheetJS)
2. `autoMapColumns` — mapeia cabeçalhos PT/EN
3. `mapRows` — valida cada linha (Zod)
4. Preview com status `ok` | `error` | `skip`
5. Confirmação → resolve entidades + `createTransaction` por linha OK
6. Job registrado em `import_jobs` / `import_job_rows`

## Exportação

- Filtros opcionais: `from`, `to` (ISO dates)
- Saída CSV ou XLSX base64 para download
- Audit em `export_jobs`
- Capability: `export.read`

## Dedup

`duplicate_hash` em transactions evita reimportar mesma linha (data + valor + descrição + conta).

## Limites

- Server action body: 4MB (`next.config.ts`)
- Sem validação de saldo bancário — apenas persistência de lançamentos

## Playbook

Detalhes operacionais: `docs/playbooks/import-export.md`.
