# Jarvis

Assistente financeiro conversacional em pt-BR.

## Pacotes e arquivos

| Arquivo                                   | Função                             |
| ----------------------------------------- | ---------------------------------- |
| `packages/jarvis/src/index.ts`            | Intents, parser, resolução         |
| `apps/web/src/server/jarvis-actions.ts`   | Server actions                     |
| `apps/web/src/components/jarvis-chat.tsx` | UI chat                            |
| `apps/web/src/components/app-shell.tsx`   | FAB + sheet global (qualquer tela) |

## Intents

Discriminated union (`jarvisIntentSchema`):

| Intent              | Descrição                |
| ------------------- | ------------------------ |
| `create_expense`    | Registrar despesa        |
| `create_income`     | Registrar receita        |
| `ask_clarification` | Pedir escolha ao usuário |
| `summary`           | Resumo do período        |
| `unknown`           | Fallback                 |

## Parser

1. **Heurístico** (default): regex de valores BRL + keywords (`gastei`, `recebi`, `resumo`)
2. **OpenAI** (opcional): se `OPENAI_API_KEY` configurada — tools em `jarvisTools`

## Resolução de entidades

`resolveIntentAgainstContext` usa `resolveEntities` (`@tim/domain`) contra centros, categorias (com aliases) e contas **do household**.

Regras:

- Nunca inventar IDs
- Ambiguidade → `ask_clarification` com opções
- Defaults de `user_preferences` (centro/conta padrão)

## Persistência

- `jarvis_threads` — uma thread por conversa
- `jarvis_messages` — histórico com `intent` JSONB

## Capabilities

| Ação             | Capability      |
| ---------------- | --------------- |
| Enviar mensagem  | `jarvis.chat`   |
| Criar lançamento | `jarvis.mutate` |

## Exemplos de utterances

```
Adicione despesa de 100 reais de supermercado no PF
Recebi 5000 de salário
Quanto gastei este mês?
```

## Voice

Campo `source: 'voice' | 'text'` — TTS opcional via preferência `tts_enabled`.

## Playbook

Adicionar intent: `docs/playbooks/add-jarvis-intent.md`.
