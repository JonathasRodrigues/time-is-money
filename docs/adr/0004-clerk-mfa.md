# ADR 0004: Clerk com MFA obrigatório

## Status

Aceito

## Contexto

App financeiro doméstico exige autenticação confiável sem implementar auth próprio.

## Decisão

- **Clerk** para sign-in/up, sessões e MFA
- Middleware em `apps/web/src/middleware.ts` protege rotas
- `getAuthSession()` mapeia Clerk user → `memberships` → role
- MFA verificado antes de operações (`requireSession`)

Redirect MFA: `/mfa-required`

## Consequências

**Positivas**

- MFA, social login, UI pronta
- JWT/session gerenciados

**Negativas**

- Custo Clerk em escala
- Dependência externa para auth
- `household` separado de Clerk Org (membership própria)

## Alternativas rejeitadas

- NextAuth credentials — MFA manual
- Auth0 — similar, Clerk melhor DX Next
