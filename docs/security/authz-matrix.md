# Matriz de autorização (RBAC)

Fonte: `/home/flaesh/time-is-money/packages/permissions/src/index.ts`

## Papéis

| Papel    | Descrição                                                    |
| -------- | ------------------------------------------------------------ |
| `admin`  | Dono do household — gerencia membros e configurações globais |
| `editor` | CRUD de lançamentos, financiamentos, import                  |
| `viewer` | Somente leitura + Jarvis chat (sem mutação)                  |

## Capabilities

| Capability           | admin | editor | viewer |
| -------------------- | :---: | :----: | :----: |
| `household.manage`   |   ✓   |        |        |
| `members.manage`     |   ✓   |        |        |
| `settings.write`     |   ✓   |   ✓    |        |
| `settings.read`      |   ✓   |   ✓    |   ✓    |
| `transactions.read`  |   ✓   |   ✓    |   ✓    |
| `transactions.write` |   ✓   |   ✓    |        |
| `financings.read`    |   ✓   |   ✓    |   ✓    |
| `financings.write`   |   ✓   |   ✓    |        |
| `plans.read`         |   ✓   |   ✓    |   ✓    |
| `plans.write`        |   ✓   |   ✓    |        |
| `import.write`       |   ✓   |   ✓    |        |
| `export.read`        |   ✓   |   ✓    |   ✓    |
| `jarvis.chat`        |   ✓   |   ✓    |   ✓    |
| `jarvis.mutate`      |   ✓   |   ✓    |        |
| `audit.read`         |   ✓   |        |        |
| `dashboard.read`     |   ✓   |   ✓    |   ✓    |

## Uso no código

```typescript
import { requireCapability, requireSession } from '@tim/auth';

const session = requireSession(ctx.session);
requireCapability(session, 'transactions.write');
```

UI pode esconder botões com `can(session, 'transactions.write')`, mas **sempre** revalidar no servidor.

## MFA

MFA TOTP do Clerk exige plano Pro. O app **não** redireciona mais para `/mfa-required` nem rejeita sessão por falta de MFA no Hobby.

Campo `session.mfaEnabled` permanece na API (sempre `true` por compatibilidade) até reativarmos o gate com Pro.

## Mapeamento rota → capability

| Área                                               | Capability mínima                     |
| -------------------------------------------------- | ------------------------------------- |
| `/dashboard`                                       | `dashboard.read` (implícito via auth) |
| `/transactions` (write)                            | `transactions.write`                  |
| `/cadastros/accounts` (CRUD bancos/contas/cartões) | `settings.write`                      |
| Pagar fatura de cartão                             | `transactions.write`                  |
| `/financings` (write)                              | `financings.write`                    |
| `/planning` (write)                                | `plans.write`                         |
| `/import-export` (upload)                          | `import.write`                        |
| `/import-export` (download)                        | `export.read`                         |
| `/jarvis` (chat)                                   | `jarvis.chat`                         |
| `/jarvis` (criar lançamento)                       | `jarvis.mutate`                       |
| `/settings/members`                                | `members.manage`                      |

## Adicionar nova capability

1. Adicionar tipo em `Capability` (`packages/permissions`)
2. Atribuir aos papéis em `ROLE_CAPABILITIES`
3. Chamar `requireCapability` nos use cases
4. Atualizar esta matriz
