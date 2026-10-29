# IZAKHONO NODE Control Plane Contract

Schema: `izakhono.node-control-plane/v1`

The control plane is the decision layer above the NODE registry. It accepts verified heartbeat data, maintains fleet state, exposes health, and selects eligible owned capacity for deployment.

## Operations

- `heartbeat` — ingest a NODE heartbeat and update registry state.
- `status` — return current fleet health and last-seen information.
- `target` — select an eligible READY NODE using explicit requirements.

## Deployment safety

A NODE is eligible only when its registry state is healthy/ready and its heartbeat is within the configured freshness window. Selection must not override security or readiness gates.

## Failure behavior

If no eligible NODE exists, return `null`/empty capacity rather than silently selecting external infrastructure. External infrastructure remains a separate reversible fallback adapter.

## Security

Heartbeat transport must be authenticated outside this module. Secrets, API keys and private credentials must never be persisted in the registry.
