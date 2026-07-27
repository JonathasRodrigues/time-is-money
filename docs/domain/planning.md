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
- `monthly_target_cents` guarda a estratégia mensal escolhida (ex.: R$ 800/mês)

## Cronograma de aportes (`plan_contributions`)

Cada linha é um mês com `due_on` e `amount_cents`. Funções em `@tim/domain`:

- `buildMonthlyContributionSchedule` — gera N meses com o mesmo valor
- `analyzeContributionSchedule` — compara meta vs saldo + soma planejada (`gapCents`)
- `targetDateFromMonthCount` — data alvo a partir do prazo em meses

Na UI, o modo **Gerar cronograma** (criação de plano) preenche os meses; o usuário pode editar valores individuais para fechar a meta quando o valor fixo mensal não basta.

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

Rota `/planning` — cards com barra de progresso, cronograma de aportes editável, itens detalhados e simulador de quitação.
