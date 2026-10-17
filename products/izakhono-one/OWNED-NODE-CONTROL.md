# IZAKHONO ONE — OWNED NODE / CONTROL CONTRACT

## Decision

IZAKHONO ONE production runtime is **node-oriented, not workstation-oriented**.

The authoritative production path is:

`IZAKHONO CONTROL -> IZAKHONO NODE -> IZAKHONO ONE`

A Windows workstation, Docker Desktop session, or single named machine may be used as a bootstrap operator only. It is never the production authority.

## Ownership boundary

- **IZAKHONO CONTROL** — desired state, node registration, rollout authorization, health evidence, deployment intent and audit correlation.
- **IZAKHONO NODE** — owner-controlled execution target that builds/runs approved workloads and reports health/evidence back to CONTROL.
- **IZAKHONO ONE** — application/control-plane workload running on an authorized NODE.
- **Supabase/Postgres** — current managed data/control-plane dependency; replaceable behind the data contract.
- **External hosts** — reversible fallback/preview only unless independently promoted through the same verification gates.

## Node identity

Every production node must have:

- stable node ID
- environment (`staging` or `production`)
- capability inventory
- runtime version
- health status
- last-seen timestamp
- deployment revision
- security posture
- control-plane registration state

Node credentials and secrets must never be committed to source control.

## Control lifecycle

`DISCOVERED -> REGISTERED -> READY -> DRAINING -> OFFLINE`

A node may receive a workload only when:

1. CONTROL recognizes the node;
2. the node is authorized for the workload;
3. the node reports healthy;
4. the requested revision is available;
5. required security/database posture is satisfied;
6. the deployment action is audit-correlated.

## IZAKHONO ONE promotion

`SOURCE VERIFIED -> CONTROL READY -> NODE READY -> DEPLOYMENT VERIFIED -> PUBLIC EDGE/TLS VERIFIED -> OWNED LIVE`

`NODE READY` means the node has actually reported the required health evidence. Source code, GitHub status, or a dashboard screenshot alone cannot create this state.

## Failover rule

A single node is never the architectural dependency.

If an active node becomes unhealthy, CONTROL must be able to place the workload into a safe degraded/draining state and select another authorized healthy node when capacity exists.

No failover may bypass FORTRESS, runtime verification, database security, or audit requirements.

## Workload contract

The IZAKHONO ONE container must remain portable:

- listen on the configured application port;
- receive configuration through environment/secrets;
- expose `/health`;
- expose owned integration health descriptors;
- remain independent of Vercel-specific runtime behavior;
- fail closed when required security posture is unavailable.

## Bootstrap compatibility

Existing `*-NODE01.cmd` scripts are retained only as **operator/bootstrap compatibility paths** until CONTROL-driven node execution is available. They must not be described as the production architecture and must not be used as evidence that an owner-controlled node fleet is live.

## Evidence standard

The following claims require corresponding evidence:

- **NODE READY:** real node health response and node registration evidence.
- **DEPLOYMENT VERIFIED:** real workload health plus revision evidence on an authorized node.
- **PUBLIC LIVE:** external HTTPS 200 plus verified experience.
- **OWNED LIVE:** public-live evidence plus proof that the production route is controlled by IZAKHONO NODE/CONTROL rather than a mandatory third-party host.
