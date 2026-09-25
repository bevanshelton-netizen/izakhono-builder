# CONNECTA Single-Container External Release

This package runs the real CONNECTA frontend and the real CONNECTA ENGINE in one OCI/Docker container.

It exists for external resilience hosts that provide one web/container service.

## Inside the container

- Next.js CONNECTA Web
- CONNECTA ENGINE
- CONNECTA authentication/session logic
- safety and moderation
- social graph and communities
- business verification
- content-owner protection
- schema migrations

## Replaceable infrastructure only

- PostgreSQL via `DATABASE_URL`
- durable media via local mounted volume or S3-compatible storage
- TLS/reverse proxy supplied by the host

No host-specific application backend is required.

## Start contract

The container:

1. runs CONNECTA migrations under the engine's PostgreSQL advisory lock;
2. starts CONNECTA ENGINE on an internal-only port;
3. waits for engine health;
4. starts CONNECTA Web on the host-provided `PORT`;
5. proxies browser traffic internally to CONNECTA ENGINE.

## Required environment

- `DATABASE_URL`
- `CONNECTA_OWNER_KEY`

Recommended production storage uses the S3-compatible adapter. Local storage is acceptable only with a durable mounted volume.

## Health

Public host health check: `GET /health`.

The external route is not called live until HTTPS 200 and the real registration/feed flow are independently verified.
