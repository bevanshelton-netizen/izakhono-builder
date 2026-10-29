# IZAKHONO NODE Registry Contract v1

The registry is the control-plane inventory of IZAKHONO-owned execution nodes.

## Required lifecycle

`DISCOVERED → AUTHENTICATED → HEARTBEATING → HEALTHY/DEGRADED → READY → PROMOTED`

A node is **not** considered online merely because it exists in configuration. It is online only when a recent heartbeat has been received.

## Registry record

Each node record contains:

- `nodeId` — stable node identity.
- `identity` — safe machine identity metadata.
- `status` — reported node status.
- `capacity` — CPU, memory, storage and runtime capacity.
- `readiness` — infrastructure readiness evidence.
- `lastSeenAt` — timestamp from the node heartbeat.
- `receivedAt` — timestamp recorded by the control plane.
- `heartbeatId` — deduplication/audit identifier.
- `staleAfterMs` — heartbeat freshness threshold.

## Safety rules

1. Never store secrets, private keys or bearer tokens in registry records.
2. A stale node must not receive new promotion work until a fresh heartbeat arrives.
3. Health and readiness are separate: a healthy node may still be unready for production promotion.
4. Registry state is operational evidence, not proof of public Internet reachability.
5. Production promotion requires independent verification of storage, backup, security, monitoring and recovery.
6. External infrastructure remains a reversible fallback and is never silently promoted to source-of-truth.
