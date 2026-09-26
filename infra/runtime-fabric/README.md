# IZAKHONO Runtime Fabric Standard

**Status:** Portfolio-wide runtime standard
**Issued:** 26 September 2026
**Policy:** No single node may be a launch gate

## Core rule

The authoritative unit is the **signed application release**, not NODE01 or any other machine.

Every platform must be deployable from the same release artifact to any approved runtime target without rebuilding the application. NODE01 may be an owned target, but it is never the sole authority, sole deployment path, or sole public-availability gate.

## Runtime classes

1. **Owned runtime** — any IZAKHONO-controlled node capable of running the approved release.
2. **Owned cluster** — the four-node k3s cluster under `infra/node-cluster` once the real hardware is installed and verified.
3. **External resilience runtime** — an approved external host used to preserve public availability and revenue continuity.
4. **Edge** — health-aware public routing that sends traffic only to a currently healthy runtime.

## Mandatory behaviour

- Build once; deploy the same immutable release everywhere.
- No product may hard-code NODE01 as its only runtime.
- No launcher may require NODE01 merely to determine whether another healthy target can serve the application.
- Public traffic must automatically avoid an unhealthy target.
- External resilience may carry production traffic while owned capacity is unavailable.
- When an owned target recovers, it must pass health and version checks before receiving traffic.
- Stateful services require their own replication/backup rules; local node disks are not the source of truth.
- Secrets remain outside release artifacts.
- A failed node must not change pricing, payments, customer data, or legal identity.

## Target preference

For workloads with multiple verified targets, the default preference is:

`OWNED HEALTHY → OWNED HEALTHY SECONDARY → EXTERNAL RESILIENCE → FAIL CLOSED`

Preference is not dependency. A preferred node may be skipped whenever it is unhealthy.

## Release identity

Every deployment must expose:

- product name;
- release version;
- immutable release/build identifier;
- health status;
- runtime/node identifier;
- data-schema compatibility version;
- whether the route is owned or external.

EDGE may only route to a target whose release identity is approved for the product.

## Deployment gate

A release is eligible for public traffic when:

1. the artifact checksum/build identity is approved;
2. the target health endpoint passes;
3. required data/auth/payment dependencies pass;
4. TLS and public routing pass for that target;
5. rollback or failover is available.

NODE01 availability is **not** a gate unless a specific product has an explicitly documented hardware dependency that only exists there.

## Failure handling

When a runtime fails:

1. remove it from traffic;
2. continue on the next healthy target;
3. preserve the release and state boundaries;
4. alert operations;
5. repair/rejoin the failed runtime;
6. restore traffic only after fresh health and release-identity verification.

## Relationship to the four-node cluster

The k3s cluster remains the long-term owner-controlled HA target. It is **not** a prerequisite for launching or keeping products public. Until all physical nodes are installed and tested, the Runtime Fabric provides the same operational principle using independent runtimes and EDGE failover.

## Standing language

Do not say “blocked by NODE01” when another approved target can run the same release. Report the actual failing target and immediately test the next target.

Do not call a target live without current health evidence.
