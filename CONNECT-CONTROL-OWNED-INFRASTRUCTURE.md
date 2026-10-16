# IZAKHONO CONNECT — OWNED INFRASTRUCTURE BOUNDARY

## Decision
IZAKHONO CONNECT must not depend on Vercel for production operation.

Vercel may be used only as an optional external preview/fallback. It is not part of the required production path.

## Production principle
**Owned-first, externally reversible.**

The application, orchestration, customer data, provisioning state, audit trail and provider abstraction must remain portable and controlled by IZAKHONO.

## Target runtime

Customer
→ IZAKHONO CONNECT
→ CONNECT CONTROL
→ IZAKHONO PROVISIONER
→ provider adapter registry
→ upstream connectivity provider

Supabase remains the current managed database/control-plane foundation. The web/runtime layer must be deployable to an IZAKHONO-controlled Linux host, VPS, dedicated server or equivalent runtime without changing business logic.

## Infrastructure rules

1. No Vercel-specific application logic.
2. No provider credentials in browser/client code.
3. No service-role database keys in client code.
4. Provider APIs are accessed only through server-side adapters/workers.
5. Provisioning is state-machine driven and idempotent.
6. Every external dependency must have a replaceable adapter boundary.
7. If an upstream API is unavailable, the system must show a blocked/manual state rather than pretending activation occurred.
8. Deployment must support containerized Linux operation.
9. Configuration must come from environment variables/secrets, not source code.
10. Production health checks and logs must be independent of any single frontend host.

## Portable application layout

- `connect-control/` — operations UI
- `provisioner/` — server-side orchestration worker
- `adapters/` — provider integrations
- `db/` — Supabase/Postgres migrations and RPCs
- `docs/` — operating procedures and deployment specifications

## Required next runtime components

- authenticated server/API boundary
- provider adapter registry
- coverage worker
- order worker
- retry/exception worker
- payment webhook receiver
- audit logging
- health endpoint
- container build
- systemd/Docker deployment specification
- backup and restore procedure

## Current truth

The database control plane and provisioning state machine exist. Provider adapter records now provide explicit manual/API/hybrid boundaries. Real upstream coverage, ordering, activation, payment and network provisioning remain unconnected until commercial credentials/API contracts are supplied.
