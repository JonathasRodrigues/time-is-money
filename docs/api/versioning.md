# Política de versionamento da API

## Major na URL

- Path: `/api/v1/...`
- Breaking changes exigem `/api/v2/...` em paralelo.
- Clients pinam o major. v1 só é removida após janela de deprecation documentada no changelog.

## Semver do contrato (`API_CONTRACT_VERSION` em `@tim/api-contract`)

Dentro de um major (ex.: v1):

| Tipo                            | Quando                                                                                 | Exemplo                  |
| ------------------------------- | -------------------------------------------------------------------------------------- | ------------------------ |
| **MAJOR** (novo path `/api/v2`) | Remove/renomeia campo, muda tipo/semântica, muda status esperado, muda auth            | `amount` string → number |
| **MINOR**                       | Campo **opcional** novo, endpoint novo, novo `error.code` (client ignora desconhecido) | `meta.foo?`              |
| **PATCH**                       | Docs/exemplos sem mudança de wire                                                      | tipografia no README     |

## Regras additive-only em v1

1. Campos novos no **response**: sempre opcionais (ou com default seguro no client).
2. Nunca reutilizar nome de campo com significado diferente.
3. Enums: só adicionar valores; clients tratam unknown com fallback.
4. GET **sem** side-effects.
5. Erros: envelope `{ error: { code, message, details? } }` — códigos não são renomeados.

## Headers

- `Accept: application/json`
- Response ecoa `X-Tim-Api-Version: 1`
- Writes (quando aplicável): `Idempotency-Key`

## Deprecation

- Marcar no OpenAPI (`deprecated: true`) + entrada no [changelog](./v1/changelog.md).
- Remoção só em major seguinte.

## Checklist de PR (obrigatório se tocar API)

1. [ ] Schema Zod atualizado em `@tim/api-contract`
2. [ ] `openApiDocument` / paths atualizados
3. [ ] Entrada em `docs/api/v1/changelog.md`
4. [ ] Teste de contrato (Vitest) novo ou atualizado
5. [ ] Classificar: additive (ok v1) vs breaking (exige v2 + aprovação)
6. [ ] Handler valida request com Zod; response tipada pelo schema
7. [ ] Client web/RN usa só tipos/paths do pacote — sem DTO paralelo
