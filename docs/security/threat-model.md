# Modelo de ameaças

Análise pragmática para Time is Money (finanças domésticas, multi-tenant).

## Ativos

| Ativo                                    | Sensibilidade |
| ---------------------------------------- | ------------- |
| Lançamentos, financiamentos              | Alta          |
| Notas criptografadas (`notes_encrypted`) | Alta          |
| Metadados de household                   | Média         |
| Threads Jarvis                           | Média         |
| Audit logs                               | Média         |

## Atores

- **Usuário legítimo** — membro do household
- **Atacante externo** — sem credenciais
- **Membro malicioso** — viewer tentando escalar privilégio
- **Agente de IA** — pode introduzir bugs ou vazamento cross-tenant

## Superfícies de ataque

| Superfície             | Risco                       | Mitigação                                             |
| ---------------------- | --------------------------- | ----------------------------------------------------- |
| Server actions         | IDOR cross-household        | Filtro `householdId` da sessão em toda query          |
| Clerk session          | Account takeover            | MFA obrigatório                                       |
| Import CSV             | XSS/injection via descrição | Escape na UI; validação Zod                           |
| Cron `/api/cron/*`     | Trigger não autorizado      | `CRON_SECRET` Bearer                                  |
| Jarvis LLM             | Alucinação de entidades     | Resolver só contra contexto real; `ask_clarification` |
| Export                 | Exfiltração em massa        | Capability `export.read`; audit em `export_jobs`      |
| ENCRYPTION_SECRET leak | Decrypt de notas            | Secret em env Vercel; chave derivada por household    |

## Ameaças STRIDE (resumo)

| Tipo            | Cenário                          | Controle                               |
| --------------- | -------------------------------- | -------------------------------------- |
| Spoofing        | Session falsa                    | Clerk JWT                              |
| Tampering       | Alterar `householdId` no payload | Validar contra sessão                  |
| Repudiation     | Negar mutação                    | `audit_logs`                           |
| Info disclosure | Ver dados de outro household     | RBAC + filtro tenant                   |
| DoS             | Upload XLSX gigante              | `bodySizeLimit: 4mb` em server actions |
| Elevation       | Viewer importa CSV               | `requireCapability('import.write')`    |

## Fora de escopo (por design)

- Integração Open Banking — **não existe**; não implementar APIs bancárias fictícias.
- Criptografia em repouso do Neon — responsabilidade do provedor.
- SOC2/compliance formal — app pessoal/familiar.

## Checklist para PRs

- [ ] Queries com `eq(table.householdId, session.householdId)`
- [ ] Mutações com capability correta
- [ ] Inputs validados com Zod
- [ ] Sem secrets hardcoded
- [ ] Sem `any`
