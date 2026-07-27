# Playbook: adicionar server action

Padrão para novas actions em `/home/flaesh/time-is-money/apps/web/src/server/`.

## Estrutura

```typescript
'use server';

import { createAppContext } from '@/server/context';
import { requireCapability, requireSession } from '@tim/auth';
import { myUseCase } from '@tim/application';

export async function myActionAction(input: MyInput): Promise<MyResult> {
  const ctx = await createAppContext();
  const session = requireSession(ctx.session);
  requireCapability(session, 'transactions.write'); // ajustar

  return myUseCase(ctx, input);
}
```

## Regras

1. **`'use server'`** no topo do arquivo
2. Lógica de negócio em `@tim/application`, não na action
3. Auth + capability antes de qualquer side effect
4. Tipos explícitos em input/output — sem `any`
5. Revalidar só o necessário — paths das telas afetadas (ver `actions.ts`: `revalidatePaths` / `MONEY_PATHS`). Use `revalidatePath('/', 'layout')` só quando o shell muda (prefs, members, banner de renda no layout).

## Organização de arquivos

| Domínio       | Arquivo             |
| ------------- | ------------------- |
| Geral         | `actions.ts`        |
| Jarvis        | `jarvis-actions.ts` |
| Import/Export | `imex-actions.ts`   |

Criar novo arquivo apenas se módulo grande (ex.: `reports-actions.ts`).

## Contexto

```typescript
// apps/web/src/server/context.ts
export async function createAppContext(): Promise<AppContext> {
  return {
    db: getDb(),
    session: await getAuthSession(),
    encryptionSecret: getEncryptionSecret(),
  };
}
```

## Erros

- `AuthError` — UI trata redirect MFA ou forbidden
- Erros de validação Zod — mensagem amigável ao usuário

## Consumo na UI

```typescript
import { myActionAction } from '@/server/actions';

// Client Component
const result = await myActionAction({ ... });
```

## Checklist

- [ ] Capability correta
- [ ] Use case com filtro household
- [ ] Input validado com Zod no application layer
- [ ] Audit log se mutação
