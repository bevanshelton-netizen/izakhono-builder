# IZAKHONO HOST — Multi-Node Owned Topology

The presence of multiple IZAKHONO nodes means the runtime is designed as a cluster, not a single-server dependency.

## Roles

| Role | Primary responsibility |
|---|---|
| CONTROL | Provisioner, customer state, jobs, audit and operator control |
| EDGE | Public HTTP/HTTPS ingress, Caddy and tenant routing |
| DNS | Authoritative DNS and secondary DNS service |
| RUNTIME | Customer site execution and static assets |
| DATA | PostgreSQL, MinIO and Valkey |
| MAIL | Postfix/Dovecot/Rspamd-class mail services |
| BACKUP | Independent encrypted backup target and restore source |
| FORTRESS | Secrets, identity, access policy and security telemetry |

A physical node may carry more than one role, but DATA, BACKUP and FORTRESS should be separated from the public edge whenever capacity permits.

## Baseline cluster

- NODE01: CONTROL + EDGE + RUNTIME
- NODE02: EDGE + RUNTIME + DNS secondary
- NODE03: EDGE + RUNTIME + DNS secondary + BACKUP
- Dedicated DATA/Mail/FORTRESS nodes may be added without changing the customer provisioning contract.

These names are logical roles, not claims that particular machines are currently reachable.

## Traffic

Internet → authoritative DNS → healthy EDGE node → native HOST runtime → customer site.

Control-plane traffic stays private. Data services are never exposed directly to the public Internet.

## Resilience rules

1. A single edge node failure must not destroy customer state.
2. Site content must be recoverable independently of the edge node.
3. DNS must have independent secondary capacity before production delegation is considered complete.
4. PostgreSQL, MinIO and Valkey must have health and recovery evidence.
5. Backups must be restorable on a different node.
6. Secrets must not be stored in Git or browser code.
7. External hosting providers remain optional adapters, never the source of truth.

## Promotion

The cluster is considered production only after public probes confirm the selected edge nodes, DNS delegation, HTTPS, native site serving and recovery paths. Repository commits alone never establish production status.
