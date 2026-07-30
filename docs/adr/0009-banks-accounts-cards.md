# ADR 0009: Bancos, contas e cartões (modelo real)

## Status

Aceito

## Contexto

O produto misturava “Contas” (a pagar/receber) com contas bancárias. O schema só tinha `cash | checking | investment_pot`, sem poupança nem cartão de crédito como passivo. PIX/cartão no import eram só strings de método de pagamento.

## Decisão

Modelo bancário BR, cadastro manual (sem Open Banking):

```
Institution (banco)
  └── Account (ativo): cash | checking | savings | investment_pot
        ├── parent_account_id para reservas/caixinhas
        └── CreditCard (passivo) via payment_account_id
              (institution_id denormalizado do banco da conta)
```

Hierarquia de produto: **cartão → conta → banco**.

- **PIX / débito / TED**: `payment_rail` opcional na transação debitada da conta — não são entidades.
- **Compra no cartão**: `transactions.credit_card_id` → aumenta `invoice_balance_cents`; não mexe no saldo da conta.
- **Pagar fatura**: use case `payCreditCardInvoice` (conta ↓, fatura ↓).
- Nav **Contas** renomeada para **A pagar** (bills).

Migração `0010_credit_cards`: ADD VALUE `savings`, tabela `credit_cards`, colunas em `transactions`. Sem backfill destrutivo.

## Consequências

**Positivas**

- Hierarquia alinhada ao uso real (banco → conta → cartão)
- Patrimônio líquido = ativos − faturas
- Dados existentes de instituições/contas preservados

**Negativas**

- Fatura é saldo corrente (sem histórico de ciclos fechados no MVP)
- Import IMEX ainda mapeia “Cartão X” para conta até matching explícito

## Alternativas rejeitadas

- Cartão como `account_kind` — confunde ativo/passivo e transferências
- PIX como conta/instrumento — no BR é meio de pagamento da corrente
