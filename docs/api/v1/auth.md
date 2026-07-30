# Auth — API v1

## Web

Clerk session cookie (mesmo fluxo do App Router). `fetch('/api/v1/...', { credentials: 'include' })`.

## React Native

1. Clerk Expo/RN SDK → `getToken()`
2. `Authorization: Bearer <session_jwt>`
3. Base URL: `EXPO_PUBLIC_API_URL` (ex.: `https://app.example.com`)

O handler `requireApiSession` aceita cookie **ou** Bearer. Sem credencial → **401 JSON** (nunca redirect HTML).

```http
GET /api/v1/me HTTP/1.1
Host: app.example.com
Authorization: Bearer eyJ...
Accept: application/json
```

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Não autenticado"
  }
}
```

## Multi-tenancy

`householdId` vem **somente** da sessão (membership). Nunca do body/query.

## Demo mode

Com `DEMO_MODE=1`, a API usa a sessão demo do monorepo — mesmo contrato JSON.
