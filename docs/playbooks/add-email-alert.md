# Playbook: adicionar alerta por email

Stack: `@tim/email` (React Email + Resend) + cron Vercel.

## 1. Template de email

Arquivo: `/home/flaesh/time-is-money/packages/email/src/index.ts`

```typescript
export function MyAlertEmail(props: { userName: string; items: MyItem[] }): React.ReactElement {
  return (
    <Html>
      <Preview>Assunto preview</Preview>
      <Body>{/* ... */}</Body>
    </Html>
  );
}

export async function sendMyAlertEmail(input: {
  apiKey: string;
  from: string;
  to: string;
  userName: string;
  items: MyItem[];
}): Promise<{ id?: string }> {
  const resend = createResendClient(input.apiKey);
  const result = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: 'Assunto',
    react: MyAlertEmail(input),
  });
  if (result.error) throw new Error(result.error.message);
  return { id: result.data?.id };
}
```

## 2. Preferência do usuário

Adicionar coluna em `user_preferences` se alerta for opt-in/out:

```typescript
weeklySummary: boolean('weekly_summary').notNull().default(false),
```

Migration + UI em `/settings/preferences`.

## 3. Dedup (outbox)

Usar `notification_outbox` para não reenviar:

```typescript
await db.insert(notificationOutbox).values({
  householdId,
  userId,
  kind: 'my_alert',
  referenceId: item.id,
  windowDays: 0,
  sentOn: today,
});
```

Unique index impede duplicatas.

## 4. Rota cron

Arquivo: `/home/flaesh/time-is-money/apps/web/src/app/api/cron/my-alert/route.ts`

```typescript
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // lógica + sendMyAlertEmail
  return NextResponse.json({ sent: count });
}
```

## 5. Vercel Cron

Registrar em `vercel.json` ou dashboard — ver `docs/ops/vercel.md`.

## 6. Env vars

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`

## Referência

Implementação existente: `/api/cron/due-reminders` — lembretes de parcelas.

## Checklist

- [ ] Respeitar opt-out do usuário
- [ ] Dedup via outbox
- [ ] Cron autenticado
- [ ] Filtrar dados por household na query
