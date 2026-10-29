# IZAKHONO NODE Control Plane Contract

Schema: `izakhono.node-control-plane/v1`

The control plane is the decision layer above the NODE registry. It accepts verified heartbeat data, maintains fleet state, exposes health, and selects eligible owned capacity for deployment.

## Operations

- `heartbeat` — ingest a NODE heartbeat and update registry state.
- `status` — return current fleet health and last-seen information.
- `target` — select an eligible READY NODE using explicit requirements.

## Deployment safety

A NODE is eligible only when its registry state is healthy, its heartbeat is fresh, and its required readiness checks are true. Selection must not override security or readiness gates.

The autonomous deployment adapter performs target selection before promotion. The selected NODE ID is persisted as execution evidence so later deployment steps have a deterministic target.

## Autonomous execution

An unavailable builder or physical NODE is a persistent gate for that branch, not a reason to stop unrelated dependency-ready branches. The execution runner skips persistent waits and continues other safe work. When the missing capability becomes available, the scheduled heartbeat wakes the gated branch.

## Failure behavior

If no eligible NODE exists, return a structured waiting result rather than silently selecting external infrastructure. External infrastructure remains a separate reversible fallback adapter.

## Security

Heartbeat transport must be authenticated outside this module. Secrets, API keys and private credentials must never be persisted in the registry.
