# IZAKHONO NODE Fabric — Physical Readiness Gate

This document separates **software-defined topology** from **verified physical infrastructure**.

## Registered topology

The production topology defines NODE01 as preferred primary, NODE02/NODE03 as control-plane failover members, and NODE04 as DR/workload capacity. The topology requires four ready nodes plus controlled failure, restore, and external-edge tests before the cluster is considered production-ready.

## Evidence required per node

A node is **READY** only when all of the following are independently evidenced on the physical machine:

1. `izakhono-node.service` is installed, enabled and healthy.
2. `/readyz` returns success on the node management interface.
3. Docker is available and healthy.
4. The owner-controlled repository source is reachable locally.
5. Node identity and HMAC credentials are present outside Git.
6. Deployment root and evidence directories are writable with restricted permissions.
7. Time synchronization is healthy enough for signed-request replay windows.
8. Required storage has sufficient capacity.
9. The node can execute an immutable test deployment and pass its localhost health gate.
10. Evidence is written and can be independently verified.

## CONNECTA placement gate

CONNECTA must not be promoted to a public owned route until NODE01 passes the above checks and the CONNECTA release itself passes:

- immutable 40-character production SHA
- PostgreSQL health
- web health
- registration/login smoke test
- feed/post persistence
- backup creation
- restore test
- rollback readiness
- IZAKHONO EDGE/TLS verification
- independent external HTTPS verification

## Cluster readiness gate

The cluster may be labelled **SOFTWARE PACKAGED** when the topology and scripts exist.

It may be labelled **PHYSICALLY VERIFIED** only after real node evidence exists for all required machines.

It may be labelled **PRODUCTION READY** only after:

- four required nodes report ready;
- control-plane quorum is healthy;
- controlled NODE01 failure/failover succeeds;
- backup and restore succeed;
- encrypted networking and secrets are verified;
- no public database/admin ports are exposed;
- IZAKHONO EDGE/TLS works;
- external HTTPS acceptance succeeds.

## Prohibited status inflation

Do not infer physical node availability from:

- GitHub files;
- CI success;
- a topology file;
- a deployment script;
- a local development machine;
- an external hosting provider;
- an unverified hostname.

The source of truth for physical readiness is signed evidence produced by the actual node.

## Current CONNECTA boundary

CONNECTA is packaged for NODE01 deployment. Until physical NODE01 evidence and the public EDGE/TLS gates are obtained, CONNECTA remains **NOT YET PUBLIC**.
