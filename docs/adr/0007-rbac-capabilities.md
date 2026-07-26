# ADR 0007: RBAC com capabilities

## Status

Aceito

## Contexto

Households compartilhados precisam de papéis distintos (admin configura, viewer só lê).

## Decisão

- Três roles: `admin`, `editor`, `viewer` (enum PG + TypeScript)
- **Capabilities** granulares em `@tim/permissions`
- Guards: `hasCapability`, `assertCapability`, `requireCapability` (`@tim/auth`)
- Membership em `memberships.role`

Matriz: `docs/security/authz-matrix.md`

## Consequências

**Positivas**

- Extensível (nova capability sem novo role)
- Testável em isolation

**Negativas**

- Dupla manutenção UI hide + server enforce
- Sem ACL por recurso individual (só role global no household)

## Alternativas rejeitadas

- Clerk org roles only — household custom com seed próprio
- ABAC — overkill para escopo familiar
