# API — Time is Money

Contrato REST versionado compartilhado por **web** e **React Native**.

| Doc                                  | Conteúdo                                                  |
| ------------------------------------ | --------------------------------------------------------- |
| [versioning.md](./versioning.md)     | Política de versão, breaking vs additive, checklist de PR |
| [v1/changelog.md](./v1/changelog.md) | Histórico do wire format v1                               |
| [v1/auth.md](./v1/auth.md)           | Cookie (web) e Bearer (RN)                                |

## Fonte da verdade

Pacote [`@tim/api-contract`](../../packages/api-contract):

- Paths (`apiPaths`)
- Schemas Zod de request/response
- Envelope de erro
- Documento OpenAPI (`openApiDocument`)
- Semver do contrato (`API_CONTRACT_VERSION`)

Clients (web/RN) **não** duplicam DTOs — importam de `@tim/api-contract`.

## Base URL

- Web: same-origin `/api/v1/...`
- Mobile: `EXPO_PUBLIC_API_URL` + `/api/v1/...`
- Spec: `GET /api/v1/openapi.json`

## Comandos

```bash
pnpm --filter @tim/api-contract test
pnpm --filter @tim/api-contract typecheck
```
