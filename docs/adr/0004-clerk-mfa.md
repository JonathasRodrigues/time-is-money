# ADR 0004: Clerk com MFA

## Status

Aceito (MFA do app desativado enquanto Hobby)

## Contexto

App financeiro doméstico exige autenticação confiável sem implementar auth próprio.
MFA TOTP no Clerk é recurso de plano **Pro** (~US$ 25/mês); no Hobby não está disponível.

## Decisão

- **Clerk** para sign-in/up e sessões (social + e-mail)
- Middleware em `apps/web/src/middleware.ts` protege rotas
- `getAuthSession()` mapeia Clerk user → `memberships` → role
- **Não** bloquear o app por MFA enquanto o plano Clerk for Hobby
- Quando houver Pro: reavaliar gate opcional em `/mfa-required` + `twoFactorEnabled`

## Consequências

**Positivas**

- Login social/email funciona no Hobby
- MFA, social login, UI pronta no Clerk quando o plano permitir

**Negativas**

- Sem 2FA nativo no Hobby
- Dependência externa para auth
- `household` separado de Clerk Org (membership própria)

## Alternativas rejeitadas

- NextAuth credentials — MFA manual
- Auth0 — similar, Clerk melhor DX Next
- Exigir MFA no Hobby — bloqueia usuários (feature Pro)
