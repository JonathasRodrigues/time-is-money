# Financiamentos

Gestão de contratos parcelados com amortização brasileira (Price / SAC) ou parcela fixa informada.

## Sistemas

| Sistema   | Uso típico                | Comportamento                                  |
| --------- | ------------------------- | ---------------------------------------------- |
| **Price** | Veículos, crédito pessoal | Parcelas iguais; juros decrescentes            |
| **SAC**   | Imóveis                   | Amortização constante; parcelas decrescentes   |
| **Fixo**  | Contrato já definido      | Replica o valor informado, sem recalcular taxa |

Taxa mensal nominal: `taxa_a.a. / 12` (padrão de simulação bancária no BR).

## Entidades

### financings

| Campo                      | Descrição                                       |
| -------------------------- | ----------------------------------------------- |
| `principal_cents`          | Valor financiado                                |
| `installment_count`        | Número de parcelas                              |
| `installment_amount_cents` | Parcela de referência (1ª / valor Price)        |
| `annual_rate_bps`          | Taxa anual em basis points (1890 = 18,90% a.a.) |
| `amortization_system`      | `price` \| `sac` \| `fixed`                     |
| `first_due_on`             | Vencimento da 1ª parcela                        |
| `institution`              | Banco/instituição (texto livre)                 |

### installments

Geradas via `buildAmortizationSchedule` (`@tim/domain`).

| Campo                 | Descrição                       |
| --------------------- | ------------------------------- |
| `amount_cents`        | Valor da parcela                |
| `interest_cents`      | Juros do período                |
| `principal_cents`     | Amortização do período          |
| `balance_after_cents` | Saldo devedor após a parcela    |
| `status`              | `pending` → `paid` \| `skipped` |

## Fluxo — criar

1. UI simula Price/SAC em tempo real (`FinancingForm`)
2. `createFinancing` grava contrato + cronograma completo

## Fluxo — pagar parcela

1. Usuário seleciona parcela + categoria + data pagamento
2. `payInstallmentWithCategory` cria `transaction` expense, marca parcela `paid`, audit

## Lembretes por email

Cron `/api/cron/due-reminders` consulta parcelas `pending` e preferências `reminder_windows_days`.

## Capability

- Leitura: `financings.read`
- Criar/pagar: `financings.write`

## UI

`/financings` — simulador + tabela de amortização + pagamento.
