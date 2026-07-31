# ADR 0011: Formas de pagamento e ciclo de fatura

## Status

Aceito

## Contexto

ADR 0009 modelou conta (ativo) + cartão (passivo com `invoice_balance_cents`). Em A pagar só se escolhia conta; `closing_day` / `due_day` não geravam ciclo; pagar fatura só ajustava saldos sem lançamento.

Na vida real BR há **dois momentos** com formas distintas:

1. **Compra / pagar conta no crédito** → forma `credit_card` → entra na fatura do ciclo; **não** mexe no saldo da corrente.
2. **Quitar a fatura** → forma na conta (`PIX`/`débito`/`TED` + conta Nubank) → **aí** o saldo da corrente sai; fatura ↓; lançamento “Pagamento fatura …” no extrato.

Ex.: mercado no Ultravioleta; no vencimento, PIX saindo da corrente Nubank.

## Decisão

1. **Forma de pagamento** é o conceito primário ao pagar/receber (não “escolher o banco”).
   - Na conta: `{ type: 'account', accountId, paymentRail }` — rótulo `PIX · Conta · Banco`.
   - No crédito: `{ type: 'credit_card', creditCardId }` — rótulo `Crédito · Cartão · Banco`.
   - Conta/banco são o **vínculo** da forma (onde o dinheiro entra/sai ou de onde a fatura é paga).
2. Tabela **`credit_card_invoices`**: ciclo (`closes_on`, `due_on`, `status` open|closed|paid), unique `(credit_card_id, closes_on)`.
3. `transactions.credit_card_invoice_id` amarra compra ao ciclo. Saldo da fatura **deriva** das compras do ciclo; `credit_cards.invoice_balance_cents` continua como cache do aberto.
4. Domínio puro `resolveInvoiceCycle` — compra **após** o fechamento cai no próximo ciclo.
5. **Quitação** da fatura: linha filha em Contas a pagar (`kind: credit_card_invoice`, pai = cartão). Ao pagar, só formas **na conta** (PIX/débito/TED); chama `payCreditCardInvoice`.

## Consequências

- Contas a pagar: compras no crédito **não** aparecem item a item — só a **fatura agrupada** para quitar o total; quitação só com forma na conta.
- Ensure fecha faturas `open` com `closes_on < today`.
- Sem juros/rotativo neste ADR.
- ~~Sem tabela `payment_methods` no MVP~~ → supersedido por **ADR 0012** (entidade + FK).

## Alternativas rejeitadas

- Só `payment_rail` sem cartão como método — não cobre “Nubank crédito X”.
- Fatura só contador sem ciclo — não respeita vencimento real.
