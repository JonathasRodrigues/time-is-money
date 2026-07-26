# Playbook: adicionar widget no dashboard

Dashboard: `/home/flaesh/time-is-money/apps/web/src/app/(app)/dashboard/page.tsx`  
Charts: `/home/flaesh/time-is-money/apps/web/src/components/charts.tsx`

## 1. Definir dados

Server Component do dashboard já tem acesso a `session` e `getDb()`.

```typescript
const session = await getAuthSession();
if (!session?.householdId) redirect('/onboarding');

const data = await db
  .select(/* ... */)
  .from(transactions)
  .where(and(eq(transactions.householdId, session.householdId), isNull(transactions.deletedAt)));
```

**Sempre** filtrar por `householdId`.

## 2. Componente visual

### Card simples

```tsx
import { Card } from '@tim/ui';

<Card title="Meu KPI">
  <p className="text-2xl font-semibold">{formatBrlFromCents(value)}</p>
</Card>;
```

### Gráfico Recharts

Adicionar componente em `charts.tsx`:

```tsx
'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export function MyChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Bar dataKey="value" fill="#0f3d33" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

Client component apenas para Recharts; dados preparados no Server Component.

## 3. Layout

Dashboard usa grid responsivo — inserir `<Card>` ou chart na seção apropriada.

## 4. Performance

- Agregar no SQL quando possível (`sum`, `groupBy`)
- Limitar período default (mês atual via `monthBounds()`)
- Evitar N+1 — joins ou maps em memória após fetch único

## 5. RBAC

Dashboard visível a todos autenticados com household. Widgets sensíveis (audit) podem checar `can(session, 'audit.read')` — obter session no server.

## 6. Testes

- Snapshot ou teste de integração opcional
- Validar query com household filter em code review

## Exemplo existente

`ExpenseByCategoryChart` — despesas agrupadas por categoria no mês.
