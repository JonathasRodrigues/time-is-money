# Playbook: import / export

Guia operacional para IMEX.

## Exportar lançamentos

1. Acesse `/import-export`
2. Selecione período (opcional) e formato CSV ou XLSX
3. Action `exportTransactionsAction` retorna base64
4. Download no cliente via `import-export-client.tsx`

**Capability:** `export.read`

## Importar planilha

### Passo 1 — Template ou Contas

**Flat:** baixe template CSV (`downloadTemplateAction`) ou use colunas:

```
data;valor;tipo;situacao;descricao;categoria;centro_custo;conta
2026-07-01;100,00;despesa;pago;Supermercado;Supermercado;Pessoa Física;Carteira / Dinheiro
2026-01-05;5000,00;receita;a receber;Salário;Salário;Pessoa Física;Nubank PF
```

**Contas:** XLSX com abas `Janeiro`…`Dezembro` (ex.: `Contas - 2024.xlsx`). Ano no nome do arquivo ou no campo da UI. Sempre despesa **paga** (extrato).

**Receitas do ano:** use flat CSV com `tipo=receita` e `situacao=a receber` (uma linha por mês), ou em Contas a receber → Adicionar → “Gerar vários meses” / receita mensal com “Materializar 12 meses”.

### Passo 2 — Upload

- Formatos: `.csv`, `.xlsx`
- Max ~4MB (limite server action)
- Formato detectado automaticamente (`detectImportFormat`)

### Passo 3 — Preview + revisão

- `previewImportAction` devolve todas as linhas e listas de categoria/conta/centro
- Na grade: edite data, valor, descrição, categoria, conta, centro; desmarque linhas para `skip`
- Contas mensal: bloco **Mapear métodos de pagamento → contas** (ex. Cartão Jooh → Nubank PF Jooh); aplica em lote
- Contas mensal: ajuste o **ano** para recalcular as datas `YYYY-MM-10`
- `Salvar ajustes` → `updateImportPreviewAction`

### Passo 4 — Confirmar

- Linhas `ok` → `resolveEntities` → `createTransaction` (source `import`)
- Linhas `skip` (ex. Financiamento) não são gravadas
- Categoria não resolvida → fallback `Outros` / `Sem categoria`
- Job salvo em `import_jobs` / `import_job_rows`

**Capability:** `import.write`

## Formato de dados

| Campo                  | Regras                                                 |
| ---------------------- | ------------------------------------------------------ |
| Data                   | `YYYY-MM-DD` ou `DD/MM/YYYY` (flat); Contas usa dia 10 |
| Valor                  | BRL (`100,00`) ou US Contas (`3,200.00`)               |
| Tipo                   | `receita`/`despesa` ou sempre despesa (Contas)         |
| Situação               | `pago`/`recebido` ou `a receber`/`a pagar`/`pending`   |
| Categoria/Centro/Conta | Match fuzzy por nome ou alias                          |

## Dedup

Mesma data + valor + descrição + conta → `duplicate_hash` existente → linha pode ser ignorada.

## Troubleshooting

| Problema                 | Solução                                               |
| ------------------------ | ----------------------------------------------------- |
| Ano Contas não detectado | Informe o ano no formulário de upload                 |
| Conta Jooh não resolve   | Crie conta `Nubank PF Jooh` ou escolha outra na grade |
| Categoria não encontrada | Ajuste na revisão ou confie no fallback `Outros`      |
| Financiamento importado  | Linhas `Financiamento` já vêm como skip               |
| Encoding CSV             | UTF-8; delimitador `;` preferido                      |
| Linhas vazias            | Ignoradas automaticamente                             |

## Código de referência

- Pacote: `/home/flaesh/time-is-money/packages/imex/src/index.ts`
- Contas: `/home/flaesh/time-is-money/packages/imex/src/contas.ts`
- Actions: `/home/flaesh/time-is-money/apps/web/src/server/imex-actions.ts`
- UI: `/home/flaesh/time-is-money/apps/web/src/components/import-export-client.tsx`

## Testes manuais

1. Export mês atual → reimportar → verificar dedup
2. XLSX flat com datas BR
3. CSV delimitador vírgula
4. `Contas - 2024.xlsx` → revisar grade → confirmar (Financiamento skip)
5. Mudar ano na revisão e verificar datas `*-10`
