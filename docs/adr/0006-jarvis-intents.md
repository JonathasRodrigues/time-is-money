# ADR 0006: Jarvis — intents tipados + parser heurístico

## Status

Aceito

## Contexto

Usuários querem registrar lançamentos e consultar resumo por linguagem natural, offline-safe e sem alucinar entidades.

## Decisão

- Pacote `@tim/jarvis` com **Zod discriminated union** de intents
- Parser **heurístico default** (`parseJarvisUtterance`)
- **OpenAI opcional** via `OPENAI_API_KEY` + function tools
- Resolução de entidades contra contexto real do household (`resolveEntities`)
- Ambiguidade → intent `ask_clarification`
- Persistência: `jarvis_threads`, `jarvis_messages`

## Consequências

**Positivas**

- Funciona sem LLM
- Intents tipados testáveis
- RBAC: `jarvis.chat` vs `jarvis.mutate`

**Negativas**

- Heurística limitada vs LLM full
- Custo OpenAI se habilitado

## Alternativas rejeitadas

- LLM-only sem schema — risco de inventar categorias
- Whisper local — complexidade; voice como metadata apenas
