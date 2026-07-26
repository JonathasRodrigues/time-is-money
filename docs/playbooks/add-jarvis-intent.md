# Playbook: adicionar intent Jarvis

Estender o assistente com novo tipo de intent.

## 1. Schema Zod

Arquivo: `/home/flaesh/time-is-money/packages/jarvis/src/index.ts`

Adicionar variante em `jarvisIntentSchema`:

```typescript
z.object({
  type: z.literal('list_financings'),
  status: z.enum(['pending', 'all']).default('pending'),
}),
```

Exportar tipo via `JarvisIntent`.

## 2. Parser heurístico

Em `parseJarvisUtterance`, detectar keywords:

```typescript
if (lower.includes('parcelas') || lower.includes('financiamento')) {
  return { type: 'list_financings', status: 'pending' };
}
```

## 3. Resolução / execução

Em `resolveIntentAgainstContext` ou em `jarvis-actions.ts`:

```typescript
if (intent.type === 'list_financings') {
  // query DB com session.householdId
  return { reply: '...' };
}
```

Mutações → `requireCapability(session, 'jarvis.mutate')`.

## 4. OpenAI tools (opcional)

Adicionar em `jarvisTools` se usar function calling.

## 5. Persistir intent

`jarvis_messages.intent` já armazena JSON — garantir serialização.

## 6. UI

Se `ask_clarification`, `jarvis-chat.tsx` renderiza `options` como botões.

## 7. Testes

`packages/jarvis/src/index.test.ts`:

```typescript
expect(parseJarvisUtterance('quais parcelas vencem')).toMatchObject({
  type: 'list_financings',
});
```

## Regras

- Nunca inventar categorias/contas — usar contexto real
- Respostas em pt-BR
- Ambiguidade → `ask_clarification`

## Documentação

Atualizar `docs/domain/jarvis.md`.
