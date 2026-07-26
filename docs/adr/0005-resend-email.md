# ADR 0005: Resend para emails transacionais

## Status

Aceito

## Contexto

Lembretes de vencimento de parcelas e futuros alertas por email.

## Decisão

- **Resend** como provider SMTP/API
- Templates com **React Email** em `@tim/email`
- Envio apenas server-side (cron ou actions)
- Dedup via `notification_outbox`

Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

## Consequências

**Positivas**

- Templates JSX tipados
- API simples, boa deliverability

**Negativas**

- Domínio precisa verificação em produção
- Sem fila persistente — falha = retry no próximo cron

## Alternativas rejeitadas

- SendGrid — React Email menos integrado
- Nodemailer SMTP direto — mais config infra
