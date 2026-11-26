# IZAKHONO NAV — HOST-managed runtime workload contract

**Contract version:** 1.0  
**Owner:** IZAKHONO AFRICA (PTY) LTD  
**Status:** API implementation and contract tests added; provider binding and runtime acceptance remain deployment operations.

## Authority and identity

NAV is a managed workload of IZAKHONO HOST / Runtime Fabric. NODE01 is a logical runtime identity, not a machine, GitHub runner, cloud instance or vendor account. HOST resolves an approved execution environment through a replaceable provider adapter. The physical/virtual execution resource is infrastructure; the logical workload and its data remain IZAKHONO-controlled.

The application is never given arbitrary shell or infrastructure-command access. HOST exposes only the typed lifecycle operations below. A provider adapter must authenticate requests, enforce an approved target allowlist, record audit events and return a stable provider reference.

## Control-plane API

All routes require Authorization: Bearer <HOST_RUNTIME_TOKEN> and are private control-plane endpoints.

| Method | Route | Purpose |
|---|---|---|
| POST | /api/workloads/nav | Provision an immutable NAV release |
| GET | /api/workloads/nav | List NAV workloads and recent jobs |
| GET | /api/workloads/nav/{id} | Inspect runtime and readiness |
| POST | /api/workloads/nav/{id}/stop | Stop the managed workload |
| POST | /api/workloads/nav/{id}/replace | Replace with another immutable release |
| POST | /api/workloads/nav/{id}/backup | Create a persistent-data backup |
| POST | /api/workloads/nav/{id}/restore | Restore from a verified backup reference |

Provisioning requires an Idempotency-Key header and JSON fields:

- release_id: stable release identifier;
- artifact_digest: immutable sha256:<64 hex> artifact digest;
- logical_runtime_id: optional logical identity, default NODE01;
- secret_ref: optional FORTRESS/secret reference, never a credential value.

The server fixes the workload name, storage profile, private network profile and required health contract. Callers cannot override network exposure, storage paths, provider identity or execution commands.

## Provider adapter

The control plane uses nav-provider-http.mjs, a bounded adapter with fixed method paths:

POST /v1/workloads/nav/{provision|inspect|stop|replace|backup|restore}

Configure HOST_NAV_PROVIDER_URL and HOST_NAV_PROVIDER_TOKEN only through the approved FORTRESS-controlled runtime secret mechanism. The adapter requires HTTPS except for loopback development endpoints, sends bearer authentication, uses a bounded request timeout, disables caching and sanitizes upstream errors. If no provider is configured, provision/inspect/lifecycle operations fail closed with NAV_RUNTIME_PROVIDER_UNAVAILABLE; no fake workload is created.

The provider must implement typed operations rather than accept arbitrary commands. It must return a stable provider_ref after provision. Inspect must return ready: true and all four health fields (engine, routing, search, tiles) as ready before HOST records the workload as ready.

## Durable state and safety

- Workload and job state is persisted atomically under HOST's data directory.
- Provision requests are idempotent by caller-supplied key.
- Jobs use explicit running / verified / failed states and bounded error codes.
- Releases are digest-pinned; mutable tags such as latest are rejected.
- Secret values are rejected; only secret references are accepted.
- Runtime readiness is not inferred from provider acceptance alone.
- Backup and restore use provider-issued backup references; restore rejects arbitrary values.
- The public EDGE/DNS/TLS route remains a separate approval and acceptance boundary.

## Runtime acceptance

The provider/runtime must persist the Nominatim database, Valhalla graph, South Africa OSM extract, PMTiles archive and edge certificate data. It must support restart, backup, isolated restore, release replacement and rollback without changing the logical NAV identity.

A workload becomes HOST ready only after engine, routing, search and tile health all pass. NAV becomes publicly operational only after the owned stack's real search, route-geometry, rendered-tile, HTTPS, Android/GPS and recovery acceptance gates pass. The existing products/izakhono-nav/stack/scripts/verify.sh remains the runtime acceptance check; API/CI success alone is not runtime evidence.

## Current integration boundary

This change supplies the HOST-side typed lifecycle API, durable state model, provider adapter and automated contract tests. It does not invent a provider binding, create paid compute, configure secrets, import South Africa data, alter public DNS or claim production readiness. Those operations require an already-authorized Runtime Fabric execution environment and owner-approved binding.
