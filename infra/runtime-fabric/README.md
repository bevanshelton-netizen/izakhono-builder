# IZAKHONO Runtime Fabric Standard

**Status:** Portfolio-wide runtime standard  
**Policy:** IZAKHONO-owned runtime nodes are the canonical execution fabric. No external hosting provider is a required runtime dependency.

## Core rule

The authoritative unit is the **signed application release**. NODE01 is a logical runtime node, not a physical-workstation dependency.

Every platform must be deployable from the same immutable release artifact to any approved IZAKHONO runtime node without rebuilding the application.

## IZAKHONO Node Cluster

The canonical cluster is:

`NODE01 → NODE02 → NODE03 → NODE04`

These identifiers represent IZAKHONO runtime nodes. They may be implemented on VMs, containers, bare-metal capacity, or other IZAKHONO-controlled execution capacity. The node identity is logical; the certification contract must prove that the named node actually exists and is running the release.

NODE01 is the preferred primary. NODE02, NODE03 and NODE04 provide failover/resilience according to the cluster topology. A node may be promoted or removed from traffic only on fresh runtime evidence.

## Platform independence decision

**Vercel is not part of the required IZAKHONO or CONNECTA runtime architecture.** No Vercel project, deployment, account, proprietary runtime, build service, routing layer, or environment variable may be a prerequisite for building, deploying, operating, certifying, or recovering CONNECTA.

- Build, release, runtime, routing, TLS, health checks, backups and recovery are to be owned and operated through IZAKHONO-controlled infrastructure and tooling.
- GitHub Actions may execute CI and evidence-gathering workflows; CI is not itself a production runtime.
- DNS registration/authoritative DNS and certificate issuance may use specialist providers only where explicitly approved, portable and replaceable. They must not make the application runtime dependent on a hosting vendor.
- External hosting may be used only as a separately approved, optional contingency. It is not assumed, not the canonical path, and not a launch prerequisite.
- Existing third-party accounts or projects are not automatically deleted by this architecture decision. They are simply outside the required runtime path; any account closure or resource deletion requires a separate inventory and explicit change plan.

## Runtime classes

1. **Owned node** — an IZAKHONO-controlled runtime node capable of running the approved release.
2. **Owned node cluster** — NODE01–NODE04 when the required nodes are actually provisioned, healthy and verified.
3. **External auxiliary service** — an explicitly approved, replaceable service for a bounded capability such as DNS or certificate issuance; never an implicit application runtime.
4. **Edge** — IZAKHONO-controlled, health-aware public routing that sends traffic only to a currently healthy approved node.

## Mandatory behaviour

- Build once; deploy the same immutable release everywhere.
- NODE01 is the preferred primary, never an unverifiable single point of truth.
- No launcher may require a physical workstation to operate or certify the node cluster.
- Public traffic must automatically avoid an unhealthy node.
- No external hosting provider is required for normal operation or launch.
- A recovered node must pass health and release-identity checks before receiving traffic.
- Stateful services require replication/backup rules; local node disks are not the sole source of truth.
- Secrets remain outside release artifacts.
- A failed node must not change pricing, payments, customer data, or legal identity.

## Target preference

`NODE01 HEALTHY → NODE02 HEALTHY → NODE03 HEALTHY → NODE04 HEALTHY → FAIL CLOSED`

Preference is not dependency. The next healthy node may be used whenever the preferred node fails verification.

## Release identity

Every node deployment must expose:

- product name;
- release version;
- immutable release/build identifier;
- health status;
- logical node identifier;
- data-schema compatibility version;
- owned route classification.

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
8. IZAKHONO EDGE routing passes;
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
