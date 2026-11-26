# Runtime Fabric DNS Publication Intent v1

## Role

`controller/dns_publication_intent.py` is the first Runtime Fabric handoff contract for owned DNS publication. It accepts a FORTRESS authorization decision and records a deterministic, durable deployment identity through the existing Runtime Fabric deployment store and append-only event store.

## Preconditions

- FORTRESS decision must be explicitly allowed.
- FORTRESS approval ID and durable audit event ID must both be present.
- Tenant, zone, desired SOA serial, approval and production environment are bound into the intent.
- Reusing an intent identity with different workload metadata is rejected.

## State and retry behavior

The deployment record is created in `CREATED`; a deterministic event ID records `dns_publication_intent`. Replays use the same deployment and event IDs. Runtime Fabric's PostgreSQL event store treats deterministic event IDs as idempotent inserts.

This component does not transition to ACTIVATING, select a host, invoke NODE01, or publish records. The deployment remains a planned governance handoff until a separately registered DNS execution adapter and healthy HOST execution environments are verified.

## Integration requirements still outstanding

- Supply a real FORTRESS principal and invoke the durable FORTRESS authorization service before calling this module.
- Supply the FORTRESS-owned PostgreSQL connection factory and apply its migration through the approved migration process.
- Bind the intent repository to the canonical Runtime Fabric PostgreSQL deployment and event stores.
- Register a DNS-specific adapter in NODE01's authenticated command gateway, with capability-scoped command validation and audit correlation.
- Require two independently placed authoritative PowerDNS environments and external UDP/TCP 53, AA, SOA parity, transfer and DNSSEC acceptance evidence before promotion.

No live database migration, host enrollment, command-gateway registration, deployment or public DNS write is performed by this module.
