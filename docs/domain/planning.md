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
- `buildSeasonalContributionSchedule` — mensal + lumps (ex.: dezembro)
- `analyzeContributionSchedule` — compara meta vs saldo + soma planejada (`gapCents`)
- `targetDateFromMonthCount` — data alvo a partir do prazo em meses

Na UI, o modo **Gerar cronograma** (criação de plano) preenche os meses; o usuário pode editar valores individuais para fechar a meta quando o valor fixo mensal não basta.

## Quitação de financiamento

Plano `financing_payoff` exige `financing_id`. O simulador usa saldo residual de principal (`estimateFinancingResidual`) e regras compostas:

### Regras (`PayoffExtraRule`)

| Tipo                 | Exemplo                      |
| -------------------- | ---------------------------- |
| `monthly_cents`      | +R$ 500 todo mês             |
| `extra_installments` | +2 parcelas/mês              |
| `annual_lump`        | +R$ 10 mil em dezembro (13º) |
| `every_n_months`     | +R$ X a cada 24 meses (FGTS) |
| `one_time`           | aporte pontual no mês N      |

Regras são **empilháveis** no mesmo cenário (ex.: 3 parcelas/mês + R$ 10 mil em dezembro).

### Modo de aplicação (`PayoffApplicationMode`)

| Modo                   | Comportamento                                                          |
| ---------------------- | ---------------------------------------------------------------------- |
| `reduce_term` (padrão) | Extra no principal; prazo encolhe — maior economia de juros            |
| `reduce_payment`       | Extra no principal; parcela/amortização é recalculada mantendo o prazo |

### Funções

- `simulatePayoffPlan` — motor mês a mês com regras + modo
- `simulatePayoffByTargetDate` — busca binária do extra mensal adicional (respeita `baseRules`)
- `simulatePayoffWithExtraPayment` — wrapper de extra fixo (compat)
- `comparePayoffStrategies` — baseline vs data-alvo vs regras compostas
- `formatMonthsAsDuration` — “3 anos e 4 meses”
- `labelPayoffExtraRules` — rótulos legíveis

A simulação **não persiste** e **não executa** amortização no banco. Amortização real continua no fluxo de pagar parcela + extra em `/financings`.

## Simulador de meta / viagem

Para kinds `travel` e `custom`:

- `simulateSavingsGoal` — projeção com aporte mensal, lumps sazonais, rendimento a.a. e inflação da meta
- `TRAVEL_ITEM_TEMPLATES` — passagem, hospedagem, alimentação, seguro, deslocamento, visto
- UI: `PlanGoalSimulator` (what-if) + templates na criação do plano

## RBAC

- Leitura: `plans.read` (viewer+)
- Mutação: `plans.write` (editor+)

## UI

Rota `/planning` — cards com barra de progresso, cronograma de aportes editável, itens detalhados, simulador de quitação (regras compostas) e simulador de reserva (viagem/custom).
