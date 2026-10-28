# IZAKHONO Runtime Fabric Standard

**Status:** Portfolio-wide runtime standard  
**Policy:** No single machine or provider may be a launch gate.

## Core rule

The authoritative unit is the **signed application release**, not NODE01 or any other physical machine.

Every platform must be deployable from the same immutable release artifact to any approved **logical runtime target** without rebuilding the application.

## Runtime classes

1. **Owned runtime** — an IZAKHONO-controlled logical/virtual runtime capable of running the approved release.
2. **Owned cluster** — the future multi-node HA fabric when additional underlying capacity is actually provisioned and verified.
3. **External resilience runtime** — an approved external runtime used to preserve public availability and revenue continuity.
4. **External auxiliary worker** — removable external capacity for development, CI, queues or other workloads; not automatically a public resilience target.
5. **Edge** — health-aware public routing that sends traffic only to a currently healthy runtime.

A runtime target may be a VM, container host, managed runtime, cloud instance, or other verified execution environment. The architecture does **not** require physical IZAKHONO-owned hardware.

## Mandatory behaviour

- Build once; deploy the same immutable release everywhere.
- No product may hard-code NODE01 as its only runtime.
- No launcher may require a physical machine merely to determine whether another healthy runtime can serve the application.
- Public traffic must automatically avoid an unhealthy target.
- External resilience may carry production traffic while an owned runtime is unavailable.
- When an owned runtime recovers, it must pass health and version checks before receiving traffic.
- Stateful services require their own replication/backup rules; local runtime disks are not the source of truth.
- Secrets remain outside release artifacts.
- A failed runtime must not change pricing, payments, customer data, or legal identity.

## Target preference

For workloads with multiple verified targets, the default preference is:

`OWNED HEALTHY → OWNED HEALTHY SECONDARY → EXTERNAL RESILIENCE → FAIL CLOSED`

Preference is not dependency. A preferred target may be skipped whenever it is unhealthy.

## Release identity

Every deployment must expose:

- product name;
- release version;
- immutable release/build identifier;
- health status;
- logical runtime identifier;
- data-schema compatibility version;
- whether the route is owned or external.

EDGE may only route to a target whose release identity is approved for the product.

## Deployment gate

A release is eligible for public traffic when:

1. the artifact checksum/build identity is approved;
2. the selected runtime target health endpoint passes;
3. required data/auth/payment dependencies pass;
4. TLS and public routing pass for that target;
5. rollback or failover is available.

Physical NODE01 availability is **not a gate**. A physical machine is not part of the canonical IZAKHONO runtime architecture unless a future product explicitly documents a genuine hardware dependency.

## Failure handling

When a runtime fails:

1. remove it from traffic;
2. continue on the next healthy target;
3. preserve the release and state boundaries;
4. alert operations;
5. repair/reprovision/rejoin the failed runtime;
6. restore traffic only after fresh health and release-identity verification.

## Certification

Certification evidence must describe the **actual logical runtime target** that served the release. It must never fabricate physical-node evidence.

A certification record should identify:

- runtime target ID/class;
- immutable release ID and checksum;
- deployment result;
- health result;
- EDGE routing result;
- DNS/TLS result;
- public smoke-test result;
- rollback/failover result;
- evidence timestamps and hashes.

Only a complete evidence set may produce `LIVE_VERIFIED`.

## Four-node hardware cluster

A future physical or virtual multi-node HA cluster may be added later, but it is **not required** for the Runtime Fabric to operate. Its existence must be established by runtime evidence, not by repository topology or configuration files.

## Standing language

Do not say “blocked by NODE01.” Report the actual runtime target that failed and test the next approved target.

Do not call a target live without current health evidence.
