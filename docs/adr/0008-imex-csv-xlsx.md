# ADR 0008: Import/Export CSV e XLSX

## Status

Aceito

## Contexto

Usuários migram de planilhas; não há Open Banking. Precisamos bulk load/export sem inventar APIs bancárias.

## Decisão

- Pacote `@tim/imex` com **SheetJS (xlsx)**
- Colunas template em pt-BR (`data`, `valor`, `tipo`, …)
- Auto-map de cabeçalhos + preview antes de commit
- Jobs auditáveis: `import_jobs`, `export_jobs`
- Dedup SHA-256 em import
- UI: `/import-export`
- Limite upload: 4MB server actions

## Consequências

**Positivas**

- Interoperável com Excel/Google Sheets
- CSV `;` compatível BR

**Negativas**

- Sem sync bidirecional banco
- Validação linha-a-linha pode ser lenta em arquivos grandes

## Alternativas rejeitadas

- OFX/QIF only — menos familiar no BR
- Integração bancária — fora de escopo e compliance
