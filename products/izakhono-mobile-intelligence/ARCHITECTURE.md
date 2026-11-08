# Architecture and trust boundaries

## Trust boundaries

1. Android app: untrusted client. Never receives service-role credentials or provider secrets.
2. API: verifies a real customer session on every request and resolves organisation membership server-side.
3. Domain modules: receive a typed, server-derived account context; never trust organisationId supplied by the client.
4. Persistence: tenant-scoped queries and database policies. Cross-tenant access tests are release blockers.
5. Workers: consume durable, idempotent jobs; action execution is allowlisted and records an audit event.
6. Integrations: OAuth scopes are least-privilege; tokens are encrypted at rest; webhooks require signature and replay verification.

## Required API middleware

- Session verification through the existing IZAKHONO customer auth system.
- Organisation membership and role authorization.
- Content-Length and streamed-body limits (initial JSON request ceiling: 64 KiB).
- Durable rate limiting keyed by user, organisation and route class. In-memory counters are not acceptable for production.
- Origin/CSRF checks for cookie-authenticated browser requests.
- Schema validation and safe error responses.
- Request ID, audit event and structured security logging.

## Automation safety

The initial action registry is deliberately narrow: in-app notification, task creation and calls to explicitly authorised outbound connections. No arbitrary shell, code, device microphone, call recording, SMS interception, hidden app launch or accessibility-service control. Webhook actions require an explicit connection approval and should be paused pending owner policy.

## Privacy and retention

Collect only data required for a stated feature. Keep consent purpose-specific and revocable. Social monitoring is limited to accounts connected by their owner or permitted public sources. Never claim access to private or blocked accounts.

## Operational release gates

Authentication, tenant isolation, durable rate limiting, request limits, webhook verification, idempotency, auditability, backup/restore, Android permission tests and app-store policy review must pass before public release.
