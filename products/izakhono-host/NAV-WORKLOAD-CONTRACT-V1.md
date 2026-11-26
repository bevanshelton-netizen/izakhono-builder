# IZAKHONO NAV — HOST WORKLOAD CONTRACT v1

## Purpose

HOST provisions and manages NAV as a portable software workload. The execution environment is a HOST-managed software capability. It is not a physical-server ownership requirement.

## Ownership and identity

- Workload: `izakhono-nav`
- Workload class: `navigation-platform`
- Logical identity: `NODE01` (portable software identity; not a machine name)
- Runtime binding: opaque HOST-managed `runtimeTargetId`, replaceable without changing workload or logical NODE identity
- Release: immutable OCI artifact identified by a verified SHA-256 digest
- Health endpoint: `/health`
- Internal application port: `8080` (adapter-configurable)
- Public ingress: IZAKHONO EDGE only after separate public acceptance

## HOST responsibilities

HOST owns the workload lifecycle and durable operational record:

1. validate and authorize a typed workload specification;
2. resolve an approved execution environment through a replaceable runtime adapter;
3. provision persistent storage and private service networking;
4. deploy the immutable release and inject secrets through approved FORTRESS controls;
5. queue South Africa map, routing and search data preparation as durable HOST jobs, then execute them through a separately configured trusted data adapter;
6. start services in dependency order and collect readiness evidence;
7. expose workload state, release identity, job status and audit history;
8. coordinate backup, restore, replacement and rollback;
9. preserve logical NODE identity and workload data when a runtime binding changes.

HOST must not expose arbitrary shell or infrastructure commands to browser clients. Provider credentials remain server-side. Provisioning and replacement are idempotent and audit logged.

## NAV service topology

- NAV engine: application API and runtime identity.
- Valhalla: routing graph and route computation.
- Nominatim: address and point-of-interest search.
- Martin/PMTiles: locally served map tiles.
- Caddy/EDGE: the only public ingress.

Router, search, tile and engine services remain on the private backplane. Persistent volumes must cover the search database, routing graph, map artefacts and required runtime state.

## Lifecycle

`REQUESTED → VALIDATING → PROVISIONING → IMPORTING_DATA → STARTING → VERIFYING → READY`

HOST also supports controlled stop/start, backup/restore, replace, rollback, pause and failure states. Each transition records timestamped audit metadata. Retries are bounded and use capped backoff.

The authenticated HOST API can queue a durable NAV data-import job only after a runtime deployment has been independently confirmed and the workload has an approved target binding. A dedicated data worker and trusted import adapter must be configured separately; queue acceptance is not import completion. A workload is not READY until runtime health, data import, routing, search, tile rendering and persistence checks pass.

## Public activation is separate

READY is an internal runtime state, not a public-live claim. Public activation additionally requires verified backup/restore, HTTPS and DNS evidence. EDGE/DNS cutover is prohibited until these gates pass and the owner explicitly approves the change.

## Vercel independence

Vercel previews and build quotas are not part of the owned-runtime acceptance path. The exact same immutable NAV release must be deployable through HOST without requiring a Vercel build.

## Current implementation scope

The provider-neutral lifecycle state machine, file-backed workload registry, authenticated HOST APIs, lease-fenced runtime worker, resumable South Africa data worker and generic authenticated HTTP adapters are implemented with tests. See [NAV-WORKLOAD-API-V1.md](./NAV-WORKLOAD-API-V1.md) and [NAV-RUNTIME-ADAPTER-CONTRACT-V1.md](./NAV-RUNTIME-ADAPTER-CONTRACT-V1.md). When an owner-approved adapter URL, server-side token and logical target binding are configured, HOST starts both bounded worker loops inside the same control-plane process. The runtime worker deploys and inspects the immutable release; the data worker verifies the Geofabrik MD5 and local SHA-256 source digest, checks that Valhalla, Nominatim and PMTiles artefacts were built from that exact source digest, validates each generated artefact SHA-256, then checks five service health checks and persistent-data health before transitioning the workload to internal READY. Long-running imports are represented by durable provider operation IDs; the worker releases its lease between polls, resumes the same idempotent operation after restart, and does not consume failure retries while an import is still running. The JSON stores remain single-process/single-writer and must not be shared by multiple replicas. No provider binding, execution resource, South Africa import, public DNS/TLS activation or public-live status is implied by this contract.
