# Planejamento (`plans`)

Metas financeiras com itens detalhados e acompanhamento via caixinha.

## Tipos de plano

| `kind`             | Uso                                    |
| ------------------ | -------------------------------------- |
| `travel`           | Viagens — hotel, passagem, etc.        |
| `financing_payoff` | Reserva para quitar financiamento cedo |
| `custom`           | Qualquer meta livre                    |

## Meta total

Não há coluna `target_cents`. A meta é **soma dos `plan_items`** (`sumPlanItems` em `@tim/domain`).

## Progresso

Quando `linked_account_id` aponta para conta `investment_pot`:

- `savedCents` = saldo da caixinha
- `progressPercent` = `computePlanProgress(saved, target)`
- `computeMonthlySavingsNeeded` estima aporte mensual até `target_date`

## Quitação de financiamento

Plano `financing_payoff` exige `financing_id`. O simulador usa:

- Saldo devedor = soma das parcelas pendentes
- `simulatePayoffByTargetDate` — amortização extra para quitar na data
- `simulatePayoffWithExtraPayment` — cenário com +R$/mês fixo
- `comparePayoffStrategies` — comparação lado a lado

Reutiliza matemática de `@tim/domain` (Price/SAC); não persiste cenários simulados.

## RBAC

- Leitura: `plans.read` (viewer+)
- Mutação: `plans.write` (editor+)

## UI

Rota `/planning` — cards com barra de progresso, itens editáveis e simulador de quitação.
