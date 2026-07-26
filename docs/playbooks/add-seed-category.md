# Playbook: adicionar categoria seed

Para incluir categoria padrão em novos households.

## 1. Constantes de domínio

Arquivo: `/home/flaesh/time-is-money/packages/domain/src/index.ts`

### Categoria pai (despesa)

```typescript
export const DEFAULT_EXPENSE_CATEGORIES: Array<{ name: string; children?: string[] }> = [
  // ...
  { name: 'Nova Categoria', children: ['Subcategoria'] },
];
```

### Categoria receita

```typescript
export const DEFAULT_INCOME_CATEGORIES: string[] = [
  // ...
  'Nova Receita',
];
```

### Aliases (opcional)

```typescript
export const DEFAULT_CATEGORY_ALIASES: Record<string, string[]> = {
  Subcategoria: ['alias1', 'alias2'],
};
```

## 2. Seed

`/home/flaesh/time-is-money/packages/db/src/seed.ts` já itera sobre as constantes — **não alterar** salvo lógica especial.

`seedHouseholdDefaults(db, householdId)` roda no onboarding.

## 3. Households existentes

Seed só roda se **não houver categorias**. Para households já criados:

- Migration manual SQL, ou
- Script one-off de seed

## 4. Documentação

Atualizar `docs/domain/categories.md` com a nova entrada.

## 5. Testes

Adicionar caso em `packages/domain/src/index.test.ts` se houver lógica nova de matching.

## Notas

- `is_system: true` na insert do seed
- Aliases ajudam Jarvis e import CSV
