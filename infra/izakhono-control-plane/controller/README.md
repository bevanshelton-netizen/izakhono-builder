# IZAKHONO Control Plane Controller

The controller is the orchestration API for the IZAKHONO owned-first infrastructure layer.

## Current endpoints

- `GET /health` — controller health and fail-closed deployment rule
- `GET /services` — infrastructure service inventory
- `GET /audit` — in-memory audit trail for the current process
- `POST /diagnostics/run` — queue a diagnostics request
- `POST /provision` — accept an idempotent provisioning request shape
- `POST /deploy` — accept a deployment request shape

## Design rules

1. The controller orchestrates proven infrastructure engines; it does not reinvent DNS, TLS, databases, mail protocols, or the Internet.
2. No request marks a service as live by itself.
3. Production adapters must be authenticated and must use secret injection, never source-controlled secrets.
4. Provisioning must become idempotent, auditable, reversible, and health-gated.
5. External providers remain replaceable adapters rather than hard-coded dependencies.

This skeleton is intentionally not a production control plane yet. The next implementation stages add persistent state, authentication, job workers, DNS adapters, deployment adapters, health gates, rollback, and provider fallbacks.
