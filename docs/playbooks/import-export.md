# Playbook: import / export

Guia operacional para IMEX.

## Exportar lançamentos

1. Acesse `/import-export`
2. Selecione período (opcional) e formato CSV ou XLSX
3. Action `exportTransactionsAction` retorna base64
4. Download no cliente via `import-export-client.tsx`

**Capability:** `export.read`

## Importar planilha

### Passo 1 — Template

Baixe template CSV (`downloadTemplateAction`) ou use colunas:

```
data;valor;tipo;descricao;categoria;centro_custo;conta
2026-07-01;100,00;despesa;Supermercado;Supermercado;Pessoa Física;Carteira / Dinheiro
```

### Passo 2 — Upload

- Formatos: `.csv`, `.xlsx`
- Max ~4MB (limite server action)

### Passo 3 — Preview

- `parseSpreadsheet` + `autoMapColumns` + `mapRows`
- Linhas com erro mostram `reason`
- Ajuste mapping se cabeçalhos forem não-padrão

### Passo 4 — Confirmar

- Linhas OK → resolve entidades (`resolveEntities`) → `createTransaction`
- Job salvo em `import_jobs`

**Capability:** `import.write`

## Formato de dados

| Campo                  | Regras                                      |
| ---------------------- | ------------------------------------------- |
| Data                   | `YYYY-MM-DD` ou `DD/MM/YYYY`                |
| Valor                  | BRL com vírgula decimal; negativo → despesa |
| Tipo                   | `receita`/`despesa` ou inferido             |
| Categoria/Centro/Conta | Match fuzzy por nome ou alias               |

## Dedup

Mesma data + valor + descrição + conta → `duplicate_hash` existente → linha pode ser ignorada.

## Troubleshooting

| Problema                 | Solução                                              |
| ------------------------ | ---------------------------------------------------- |
| Colunas não mapeadas     | Renomear cabeçalhos ou mapping manual                |
| Categoria não encontrada | Criar em `/settings/categories` ou corrigir planilha |
| Encoding CSV             | UTF-8; delimitador `;` preferido                     |
| Linhas vazias            | Ignoradas automaticamente                            |

## Código de referência

- Pacote: `/home/flaesh/time-is-money/packages/imex/src/index.ts`
- Actions: `/home/flaesh/time-is-money/apps/web/src/server/imex-actions.ts`

## Testes manuais

1. Export mês atual → reimportar → verificar dedup
2. XLSX com datas BR
3. CSV delimitador vírgula
