# IZAKHONO HOST — Owned Node Cluster

**LOCKED ARCHITECTURE:** IZAKHONO-owned nodes are the infrastructure of record.

There is no single-machine production dependency. The IZAKHONO runtime is a multi-node platform operated across the owned node cluster.

## Roles

| Role | Primary responsibility |
|---|---|
| CONTROL | Provisioner, customer state, jobs, audit and operator control |
| EDGE | Public HTTP/HTTPS ingress and tenant routing |
| DNS | Authoritative and secondary DNS |
| RUNTIME | Customer site execution and static assets |
| DATA | PostgreSQL, MinIO and Valkey |
| MAIL | Owned mail services and acceptance |
| BACKUP | Independent encrypted backup and restore |
| FORTRESS | Secrets, identity, access policy and security telemetry |

A node may carry multiple roles. The architecture is not tied to a particular machine.

## Baseline node fabric

- NODE01: CONTROL + EDGE + RUNTIME
- NODE02: EDGE + RUNTIME + DNS secondary
- NODE03: EDGE + RUNTIME + DNS secondary + BACKUP
- Dedicated DATA, MAIL and FORTRESS nodes can be added without changing the customer provisioning contract.

These are IZAKHONO node roles, not external hosting dependencies.

## Traffic

Internet → IZAKHONO authoritative DNS → healthy owned EDGE node → native IZAKHONO HOST runtime → customer site.

Control-plane traffic remains private. Data services are never exposed directly to the public Internet.

## Non-negotiable rules

1. IZAKHONO-owned nodes are the source of truth.
2. No Vercel, Netlify or other hosted platform is required for production runtime.
3. External providers may exist only as bounded, reversible adapters, registrars, integrations or fallback paths.
4. Customer state must survive loss of an individual node.
5. Site content must be independently recoverable.
6. DNS must have independent secondary capacity.
7. PostgreSQL, object storage and cache services require health and recovery evidence.
8. Backups must be restorable onto another owned node.
9. Secrets must never be committed to Git or browser code.
10. The provisioning engine must never declare LIVE without acceptance evidence.

## Production authority

The node cluster is the deployment target. Repository code defines the software; the owned nodes provide the runtime capacity.

Physical activation, public DNS delegation and external reachability are execution steps on the owned node fabric—not reasons to redesign the architecture around another machine or hosted platform.
