# IZAKHONO Runtime Fabric Standard

**Status:** Portfolio-wide runtime standard  
**Policy:** No single machine, provider, or node is a launch gate by itself.

## Core rule

The authoritative unit is the **signed application release**. NODE01 is a logical runtime node, not a physical-workstation dependency.

Every platform must be deployable from the same immutable release artifact to any approved runtime node without rebuilding the application.

## IZAKHONO Node Cluster

The canonical cluster is:

`NODE01 → NODE02 → NODE03 → NODE04`

These identifiers represent IZAKHONO runtime nodes. They may be implemented on VMs, containers, cloud runtimes, or other approved execution capacity. The node identity is logical; the certification contract must prove that the named node actually exists and is running the release.

NODE01 is the preferred primary. NODE02, NODE03 and NODE04 provide failover/resilience according to the cluster topology. A node may be promoted or removed from traffic only on fresh runtime evidence.

## Runtime classes

1. **Owned node** — an IZAKHONO-controlled runtime node capable of running the approved release.
2. **Owned node cluster** — NODE01–NODE04 when the required nodes are actually provisioned, healthy and verified.
3. **External resilience runtime** — an approved external runtime used to preserve public availability and revenue continuity.
4. **External auxiliary worker** — removable external capacity for development, CI, queues or other workloads; not automatically a public resilience target.
5. **Edge** — health-aware public routing that sends traffic only to a currently healthy approved node.

## Mandatory behaviour

- Build once; deploy the same immutable release everywhere.
- NODE01 is the preferred primary, never an unverifiable single point of truth.
- No launcher may require a physical workstation to operate or certify the node cluster.
- Public traffic must automatically avoid an unhealthy node.
- External resilience may carry production traffic while owned nodes are unavailable.
- A recovered node must pass health and release-identity checks before receiving traffic.
- Stateful services require replication/backup rules; local node disks are not the sole source of truth.
- Secrets remain outside release artifacts.
- A failed node must not change pricing, payments, customer data, or legal identity.

## Target preference

`NODE01 HEALTHY → NODE02 HEALTHY → NODE03 HEALTHY → NODE04 HEALTHY → EXTERNAL RESILIENCE → FAIL CLOSED`

Preference is not dependency. The next healthy node may be used whenever the preferred node fails verification.

## Release identity

Every node deployment must expose:

- product name;
- release version;
- immutable release/build identifier;
- health status;
- logical node identifier;
- data-schema compatibility version;
- owned/external route classification.

EDGE may only route to a node whose release identity is approved for the product.

## Cluster certification gate

A node cluster is eligible for `LIVE_VERIFIED` only when actual evidence proves:

1. NODE01–NODE04 runtime identities are reachable or the documented quorum/failover policy is satisfied;
2. the approved immutable release is running;
3. node health checks pass;
4. deployment identity and schema compatibility pass;
5. required data/auth/payment dependencies pass;
6. controlled node failure/failover succeeds;
7. backup and restore evidence passes;
8. EDGE routing passes;
9. DNS and TLS pass;
10. public application smoke tests pass;
11. rollback/recovery is available.

Repository topology, CI success, configuration files or expected node names are **not runtime evidence**.

## Fail-closed rule

If any required production gate is missing, stale, simulated, inferred, topology-only, CI-only or repository-only, the certification result remains `BLOCKED` and public traffic must not be declared live on the basis of that evidence.

## Failure handling

When a node fails:

1. remove it from traffic;
2. continue on the next verified healthy node;
3. preserve release and state boundaries;
4. alert operations;
5. repair/reprovision/rejoin the failed node;
6. restore traffic only after fresh health and release-identity verification.

## Certification evidence

Every certification record must identify the actual node(s) involved and include evidence timestamps and hashes. Never fabricate node evidence and never convert a topology declaration into a runtime PASS.

## Standing language

Do not say “there is no NODE.” The IZAKHONO architecture has runtime nodes. Do not say a node is live without current runtime evidence.
