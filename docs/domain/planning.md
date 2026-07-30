# Planejamento (`plans`)

Metas financeiras com itens detalhados e acompanhamento via caixinha.

## Tipos de plano

| `kind`                     | Uso                                                                |
| -------------------------- | ------------------------------------------------------------------ |
| `travel`                   | Viagens — hotel, passagem, etc.                                    |
| `financing_payoff`         | Reserva para quitar qualquer financiamento cedo                    |
| `real_estate_amortization` | Simular amortização (prazo vs parcela) de financiamento **imóvel** |
| `custom`                   | Qualquer meta livre                                                |

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

## Quitação de financiamento (`financing_payoff`)

Exige `financing_id` (qualquer categoria). Simulador com estratégia contínua (parcelas extras, 13º, FGTS, data-alvo) e modo `reduce_term` / `reduce_payment`.

## Amortização imobiliária (`real_estate_amortization`)

Exige `financing_id` de financiamento com `category = real_estate` e saldo residual > 0.

Fluxo principal (estilo banco):

1. Informar **valor a amortizar** (ex.: R$ 90 mil)
2. O sistema escolhe as parcelas **do final** do cronograma real, somando o **principal** até completar o valor (última pode ser parcial)
3. Escolher **reduzir prazo** (mantém parcela) ou **reduzir parcela** (mantém prazo)
4. Ver antes/depois: prazo, parcela/amortização, juros economizados, data de quitação e lista das parcelas cobertas

Funções de domínio: `pickTrailingInstallmentsForAmortization` + `simulateSingleAmortization` (com `installments` pending).

Na UI de amortização imobiliária há também **“Quero terminar até…”**: a partir da data-alvo (atalhos 3/5/10/15 anos), `recommendPayoffPlansForTargetDate` sugere planos concretos — N parcelas extras/mês, R$/mês, aporte em dezembro, combinações — com prazo, juros e economia.

### Modo de aplicação (`PayoffApplicationMode`)

| Modo                   | Comportamento                                                          |
| ---------------------- | ---------------------------------------------------------------------- |
| `reduce_term` (padrão) | Extra no principal; prazo encolhe — maior economia de juros            |
| `reduce_payment`       | Extra no principal; parcela/amortização é recalculada mantendo o prazo |

### Estratégia contínua (só `financing_payoff`)

Regras compostas empilháveis (`PayoffExtraRule`):

| Tipo                 | Exemplo                      |
| -------------------- | ---------------------------- |
| `monthly_cents`      | +R$ 500 todo mês             |
| `extra_installments` | +2 parcelas/mês              |
| `annual_lump`        | +R$ 10 mil em dezembro (13º) |
| `every_n_months`     | +R$ X a cada 24 meses (FGTS) |
| `one_time`           | aporte pontual no mês N      |

### Funções

- `simulateSingleAmortization` — amortização pontual (valor + modo), com antes/depois
- `simulatePayoffPlan` — motor mês a mês com regras + modo
- `simulatePayoffByTargetDate` — busca binária do extra mensal adicional (respeita `baseRules`)
- `simulatePayoffWithExtraPayment` — wrapper de extra fixo (compat)
- `comparePayoffStrategies` — baseline vs data-alvo vs regras compostas
- `formatMonthsAsDuration` — “3 anos e 4 meses”
- `labelPayoffExtraRules` — rótulos legíveis

A simulação **não persiste** e **não executa** amortização no banco. Amortização real continua no fluxo de pagar parcela + extra em `/financings` (hoje só `reduce_term`).

## Simulador de meta / viagem

Para kinds `travel` e `custom`:

- `simulateSavingsGoal` — projeção com aporte mensal, lumps sazonais, rendimento a.a. e inflação da meta
- `TRAVEL_ITEM_TEMPLATES` — passagem, hospedagem, alimentação, seguro, deslocamento, visto
- UI: `PlanGoalSimulator` (what-if) + templates na criação do plano

## RBAC

- Leitura: `plans.read` (viewer+)
- Mutação: `plans.write` (editor+)

## UI

Rota `/planning` — cards com barra de progresso, cronograma de aportes editável, itens detalhados, planos de quitação / amortização imobiliária e simulador de reserva (viagem/custom). Em `/financings`, contratos `real_estate` ganham o CTA **Planejar amortização**.
