# Criptografia

Implementação: `/home/flaesh/time-is-money/packages/crypto/src/index.ts`

## Algoritmo

- **AES-256-GCM** com IV aleatório (12 bytes) e auth tag (16 bytes)
- Payload armazenado em Base64: `IV || authTag || ciphertext`

## Derivação de chave

```typescript
scryptSync(`${ENCRYPTION_SECRET}:${householdId}`, 'time-is-money-aes', 32);
```

Cada household tem chave derivada distinta — vazamento de um household não decifra outro.

## Campos criptografados

| Tabela         | Campo             | Quando                                    |
| -------------- | ----------------- | ----------------------------------------- |
| `transactions` | `notes_encrypted` | `notes` preenchido em `createTransaction` |

Campos como `description` permanecem em texto claro (busca/export).

## Variável de ambiente

`ENCRYPTION_SECRET` — mínimo 32 caracteres aleatórios. **Nunca** commitar.

Rotação: alterar secret invalida notas existentes. Planejar re-encrypt migration se necessário.

## Uso

```typescript
import { encryptSensitiveField, decryptSensitiveField } from '@tim/crypto';

const encrypted = encryptSensitiveField(notes, secret, householdId);
const plain = decryptSensitiveField(encrypted, secret, householdId);
```

## O que NÃO criptografamos

- Valores monetários, datas, categorias — necessários para agregações SQL
- Dados em export CSV/XLSX — export inclui descrição, não notas por padrão
- Tokens Clerk/Resend — nunca persistidos no DB

## Ameaças mitigadas

- DBA ou backup leak lendo notas pessoais
- Cross-tenant decrypt (chave por household)

## Limitações

- Secret único global — comprometimento total afeta todos os households (mas chaves derivadas ainda isolam por householdId)
- Sem envelope encryption ou KMS — adequado para escopo atual
