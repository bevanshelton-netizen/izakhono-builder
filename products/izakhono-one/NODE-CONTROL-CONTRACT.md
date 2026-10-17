# IZAKHONO NODE Control Contract

## Authority

Production execution follows:

`IZAKHONO CONTROL -> IZAKHONO NODE -> IZAKHONO ONE`

A workstation, Docker Desktop installation, or Vercel project is not production authority.

## Node lifecycle

`DISCOVERED -> REGISTERED -> READY -> DRAINING -> OFFLINE`

A node can become `READY` only when it is registered, healthy, and reports a ready security posture.

## Deployment gate

A workload revision may be authorized only when:

- the node is registered;
- FORTRESS authorizes the owner/admin execution request;
- the node is healthy;
- the node security posture is ready; and
- the target revision is explicit.

Deployment is considered verified only after the node reports the same authorized revision while remaining healthy and secure.

## Fail-closed rules

- Unknown nodes cannot receive workloads.
- Unhealthy nodes cannot receive workloads.
- Draining/offline nodes cannot receive workloads.
- Unknown security posture cannot receive workloads.
- A revision different from the authorized revision cannot be marked deployed.
- Member access cannot authorize node execution.

## Current implementation

`services/node-control.mjs` provides the deterministic control contract and an in-memory state store for foundation/testing. It is deliberately separated from persistent database storage so the state machine can be verified before the persistence adapter is promoted.

The next integration gate is to bind this contract to the existing `one.service_registry`, `one.service_runtime_state`, `one.service_events`, `one.runtime_events`, and `one.audit_events` tables through a backend-only persistence adapter, then expose authenticated control endpoints.

## Promotion evidence

`SOURCE VERIFIED -> CONTROL READY -> NODE READY -> DEPLOYMENT VERIFIED -> PUBLIC EDGE/TLS VERIFIED -> OWNED LIVE`

No production-live claim is made by this contract alone.
