# Import / Export (IMEX)

Pacote: `/home/flaesh/time-is-money/packages/imex`  
Server actions: `/home/flaesh/time-is-money/apps/web/src/server/imex-actions.ts`  
UI: `/import-export`

## Formatos suportados

- **CSV** — delimitador `;` ou `,` (auto-detect)
- **XLSX flat** — primeira aba, cabeçalhos do template
- **XLSX Contas (mensal)** — abas `Janeiro`…`Dezembro` sem cabeçalho nem data

## Template de colunas (flat)

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

## Formato Contas (abas mensais)

Detectado quando há ≥ 3 abas com nomes de mês. Abas como `Resumo`, `Receita`, `Poupança`, etc. são **ignoradas**.

| Coluna (posição) | Conteúdo                             |
| ---------------- | ------------------------------------ |
| A                | `Fixo` / `Variável` → tags           |
| B                | Descrição                            |
| C                | Valor (`R$ 3,200.00` ou BR)          |
| D                | Método de pagamento → conta sugerida |
| E                | Categoria (mapeada para seed TIM)    |

- **Data:** dia `10` do mês da aba; ano do nome do arquivo (`Contas - 2024.xlsx`) ou campo na UI
- **Financiamento:** linhas com descrição `Financiamento` entram como `skip` (parcelas vêm de `/financings`)
- **Cartão Jooh** → conta sugerida `Nubank PF Jooh` (usuário confirma o mapeamento método→conta na UI)

## Pipeline de importação

1. Upload → `detectImportFormat` → `parseSpreadsheet` **ou** `parseContasMonthlyWorkbook`
2. Preview rico (`previewImportAction`) com todas as linhas + opções do household
3. **Revisão editável** na UI (data, valor, categoria, conta, centro, importar/skip)
4. `updateImportPreviewAction` persiste ajustes
5. `commitImportAction` → `resolveEntities` (+ aliases) → `createTransaction`
6. Categoria sem match → fallback `Outros` / `Sem categoria`

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
