# IZAKHONO ID

Shared identity service with **hard entity-scoped sessions**.

## Business rule

IZAKHONO infrastructure may be shared, but each operating entity remains separate.

A user's identity can exist once, but every login session is bound to exactly one entity membership. Downstream services receive both:

- `subject`
- `entity_id`
- `entity_slug`
- `role`

A session created for Entity A cannot silently become a session for Entity B.

## Alpha capabilities

- entity registry
- user accounts
- entity memberships and roles
- PBKDF2-HMAC-SHA256 password hashing with unique salts
- entity-scoped bearer sessions
- token hashes stored instead of raw session tokens
- login/logout
- internal token introspection for other IZAKHONO services
- fail-closed inactive entity/user/membership checks

## Endpoints

- `GET /healthz`
- `POST /api/v1/admin/entities`
- `POST /api/v1/admin/users`
- `POST /api/v1/admin/memberships`
- `POST /api/v1/login`
- `POST /api/v1/logout`
- `GET /api/v1/me`
- `POST /api/v1/internal/introspect`

## Production gates

Before public use, add MFA, account recovery, email verification, brute-force throttling, audit events, device trust, secret rotation, breach-response controls, privacy/retention rules and a hardened owner database.

This alpha is an identity boundary, not a claim of production IAM readiness.
