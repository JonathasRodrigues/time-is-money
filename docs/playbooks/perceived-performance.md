# Playbook: percepção de velocidade (SWR + optimistic)

Padrão TIM para UI que não parece “amadora” / travada. Stack atual: RSC + Server Actions — **sem React Query** até o critério de escalada.

## Regras de UX

1. **Feedback no clique (&lt;100ms):** toast loading (`beginActionToast`), spinner no botão, ou linha some (`useOptimistic`) — antes do `await` / dentro do mesmo frame.
2. **Stale-while-revalidate:** filtro/nav soft — conteúdo anterior fica; chip/banner “Atualizando…” + barra fina no header. Sem skeleton full-page em troca de filtro.
3. **Loading local:** nunca fade/overlay na página inteira.
4. **Revalidação estreita:** mutations quentes usam `revalidatePaths(MONEY_PATHS|…)` em `apps/web/src/server/actions.ts`. Layout (`revalidateApp`) só para shell/banner/prefs.

## Helpers

- `beginActionToast` + `runWithToast({ toastId, success })` — [`action-toast.ts`](../../apps/web/src/lib/action-toast.ts)
- Soft nav — [`navigating.tsx`](../../apps/web/src/components/navigating.tsx), [`NavigatingContent`](../../apps/web/src/components/navigating-content.tsx)
- Contas otimistas — [`payments-table.tsx`](../../apps/web/src/components/payments-table.tsx)

## Critério de escalada → React Query + API

Medir em Contas / Transações (filtro + pagar 1 item), demo local:

| Sinal                                                                                      | Ação                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Toast/spinner no clique + lista otimista; sensação de pronto &lt; ~400ms                   | Ficar no RSC                                                                                                                       |
| Após revalidação estreita + toast no clique, UI ainda “morta” &gt; ~700ms sem mudança útil | Migrar **só listas** para client cache (`useQuery`) + route handlers; RSC para shell/auth. Domínio permanece em `@tim/application` |

Não reinventar regras no client. Não migrar o monólito inteiro de uma vez.
