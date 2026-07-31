# ADR 0012: Forma de pagamento como entidade

## Status

Aceito (supersede parcialmente ADR 0011 §1 / “sem tabela payment_methods”)

## Contexto

ADR 0011 definiu forma de pagamento como conceito primário, mas no MVP as formas eram **sintetizadas na UI** a partir de `accountId` + `payment_rail` (varchar), sem tabela nem FK. Isso gerou inconsistência: Contas a pagar parecia “vinculada à conta”, e o meio não era dado de domínio.

## Decisão

1. Tabela **`payment_methods`**:
   - `type`: `account` | `credit_card`
   - `account_id` (FK) — conta vinculada (onde o dinheiro entra/sai ou conta de quitação da fatura)
   - `credit_card_id` (FK, só `credit_card`)
   - `payment_rail` (`pix`/`debit`/`ted`/`boleto`/…; null no crédito)
2. Ao **criar conta** (checking/savings/cash): seed PIX, débito, TED, boleto.
3. Ao **criar cartão** com crédito: seed uma forma `credit_card`.
4. `transactions.payment_method_id` e `transaction_series.default_payment_method_id` como FK.
5. `payment_rail` / `account_id` no lançamento permanecem por compatibilidade e denormalização; a fonte de verdade da forma é o FK.
6. Lookups de Contas a pagar leem `payment_methods` — **não** flatMap de rails na UI.

## Consequências

- Migration `0015_payment_methods` faz seed + backfill do legado (`account`+`rail` → FK).
- UI e API passam a usar UUID de forma.
- ADR 0011 continua válido para ciclo de fatura; só a parte “sem tabela” fica obsoleta.

## Alternativas rejeitadas

- Continuar só com `payment_rail` varchar — sem identidade, sem FK, UI inventa opções.
- Tabela só de “meios” sem vínculo a conta — não modela “PIX desta corrente Nubank”.
