# Glossário

Termos do domínio Time is Money.

| Termo                        | Definição                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------- |
| **Household**                | Unidade multi-tenant — grupo que compartilha finanças (família, casal).         |
| **Membership**               | Vínculo entre usuário Clerk e household, com papel RBAC.                        |
| **Centro de custo**          | Segmento financeiro (ex.: Pessoa Física, Empresa X). Agrupa contas.             |
| **Conta**                    | Origem/destino do dinheiro dentro de um centro (ex.: Carteira, Conta Corrente). |
| **Categoria**                | Classificação income/expense, hierárquica (pai/filho).                          |
| **Alias**                    | Sinônimo de categoria para matching (Jarvis, import).                           |
| **Lançamento (transaction)** | Registro de receita ou despesa em centavos (`amount_cents`).                    |
| **Financiamento**            | Contrato parcelado (empréstimo, consórcio, parcelamento).                       |
| **Parcela (installment)**    | Vencimento individual de um financiamento.                                      |
| **Jarvis**                   | Assistente conversacional para consultas e lançamentos por linguagem natural.   |
| **Intent**                   | Estrutura tipada representando o que o usuário quer (ex.: `create_expense`).    |
| **Capability**               | Permissão granular do RBAC (ex.: `transactions.write`).                         |
| **Import job**               | Pipeline de importação CSV/XLSX com preview e linhas validadas.                 |
| **Duplicate hash**           | SHA-256 para detectar lançamentos duplicados na importação.                     |
| **Audit log**                | Registro imutável de ações para rastreabilidade.                                |
| **PWA**                      | Progressive Web App — instalável via manifest.                                  |
| **Soft delete**              | `deleted_at` em transactions — excluído logicamente, fora de relatórios.        |

## Convenções

- **Valores:** sempre `amount_cents` (integer). Ex.: R$ 100,00 → `10000`.
- **Datas:** string ISO `YYYY-MM-DD` em `occurred_on`, `due_on`, `paid_on`.
- **Moeda:** BRL — formatação via `formatBrlFromCents` em `@tim/domain`.
- **Idioma UI:** pt-BR.

## Abreviações

| Sigla | Significado                  |
| ----- | ---------------------------- |
| RBAC  | Role-Based Access Control    |
| MFA   | Multi-Factor Authentication  |
| IMEX  | Import/Export                |
| ADR   | Architecture Decision Record |
