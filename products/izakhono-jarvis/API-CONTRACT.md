# J.A.R.V.I.S. API Contract — v1

All routes are proposed contracts until implemented and covered by integration tests.

## Common response envelope

```json
{ "ok": true, "data": {}, "request_id": "req_..." }
```

Errors use `{ "ok": false, "error": { "code": "...", "message": "..." }, "request_id": "..." }`.

## Status

`GET /api/jarvis/v1/status`

Returns readiness, build version and non-sensitive capability flags. Distinguish `available`, `configured`, `degraded` and `disabled`. Never return secrets or raw environment values.

## Conversation

`POST /api/jarvis/v1/conversations`

Creates a conversation within the caller's authorized tenant.

`POST /api/jarvis/v1/conversations/:id/messages`

Request:
```json
{ "text": "Summarise my business operations", "client_message_id": "uuid" }
```

Response should stream typed events: `message.delta`, `tool.proposed`, `approval.required`, `tool.started`, `tool.completed`, `message.completed`, `error`.

## Action approval

`POST /api/jarvis/v1/actions/:id/approve`

Request:
```json
{ "approval_token": "one-time-token", "expected_payload_hash": "sha256:..." }
```

The server rechecks actor, tenant, permission, expiry, payload hash, target and action status. Approval is single-use.

## Memory

`GET /api/jarvis/v1/memory/search?q=...`

Search is always filtered by authenticated tenant, user scope, project scope and permissions. The caller cannot supply or override tenant identity in query parameters.

## Implementation requirements

- Validate every request with a runtime schema.
- Use secure session cookies and same-origin protections.
- Never trust tenant/user IDs supplied by the browser.
- Add idempotency for writes and deduplicate client retries.
- Log structured events without secrets or unnecessary personal data.
- Return no stack traces or provider errors to clients.
