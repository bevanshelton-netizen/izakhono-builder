# IZAKHONO HOST v0.3

IZAKHONO HOST is the owned-first customer hosting control plane for domains, websites, SSL, DNS, email and billing.

## Production architecture

`IZAKHONO CODE → BUILDER → PROVISIONER → IZAKHONO logical node roles → execution-host capacity → CoreDNS/Caddy/TLS → native site runtime`

The customer web runtime is owned by IZAKHONO. External services are bounded adapters and are not the runtime of record.

## Native runtime

`runtime/control-plane` now:
- provisions a tenant site record;
- creates the site's persistent public document root;
- serves static site content by customer hostname;
- exposes `/health`;
- exposes `/api/tls/ask` for Caddy on-demand TLS admission;
- records acceptance evidence for HTTPS, DNS and content;
- persists site/deployment state on the owned data volume.

`docker-compose.owned.yml` supplies the owned-runtime baseline: native runtime, Caddy edge, CoreDNS, PostgreSQL, MinIO and Valkey.

## Managed NAV workload runtime

HOST exposes an authenticated workload lifecycle API and runs its lease-fenced NAV runtime/data workers inside the same control-plane process as the file-backed single-writer stores. The generic HTTP adapters are disabled by default. They start only when an owner-approved HTTPS adapter URL, server-side token and logical HOST target binding are injected through FORTRESS-controlled runtime configuration.

Runtime worker configuration: HOST_NAV_RUNTIME_ADAPTER_URL, HOST_NAV_RUNTIME_ADAPTER_TOKEN, HOST_NAV_RUNTIME_TARGET_ID and optional HOST_NAV_RUNTIME_ADAPTER_ID.

Data worker configuration: HOST_NAV_DATA_ADAPTER_URL and HOST_NAV_DATA_ADAPTER_TOKEN. These may use the runtime adapter URL/token when the same trusted service implements both contracts.

The runtime worker deploys an immutable digest, verifies the deployed release and automatically queues the South Africa data job. The data worker verifies the South Africa Geofabrik source, Valhalla graph, Nominatim index, PMTiles archive, all five NAV service health checks and persistent-data health before HOST advances the workload to internal READY. Long-running imports use durable provider operation IDs and resumable polling.

The JSON workload/data-job stores are single-process/single-writer. Keep both worker loops in this same HOST process; do not scale multiple replicas against the same files. Move state to a transactional shared database before multi-replica operation. Public-live still requires independent backup/restore, HTTPS and DNS evidence.

## Logical node roles and execution hosts

`CLUSTER-NODE-ROLES.md` defines logical workload roles and the resilience model. Role names such as NODE01, NODE02 and NODE03 are software/orchestration identities; they are not physical servers or cloud instances.

A separate physical or virtual **execution host** supplies CPU, memory, storage and network capacity. The execution host must be identified, ownership/administrative authority verified, inspected and approved before activation. A logical node role is bound to a real execution host only through the documented Runtime Fabric/FORTRESS authorization and evidence process.

`NODE-PREFLIGHT.sh` is a read-only host suitability check. It must be run on the actual designated Linux execution host after its identity and authorization are established; it does not discover, create or enroll a server.

## Activation

On the approved execution host designated for the initial CONTROL/EDGE/RUNTIME roles, run the preflight first:

```bash
./NODE-PREFLIGHT.sh
```

Only after owner approval of the target, configuration, cost and change plan, run the activation script on that same execution host:

```bash
./NODE01-ACTIVATE.sh
```

The script name preserves the logical role label; its target is the separately approved execution host. For a first-time host this creates `.env` with generated secrets. Set `TLS_EMAIL` to the operational certificate address before public HTTPS activation. Never commit `.env`.

Activation starts workloads and is therefore not a read-only inspection step. Do not run it on an unidentified workstation, CI runner or production host without explicit approval.

## Recovery

- `backup-owned.sh` creates a verified SHA-256 runtime backup.
- `restore-owned.sh <backup.tar.gz>` performs a controlled state restore after explicit confirmation.
- `runtime/control-plane/smoke.mjs` is the native end-to-end smoke test used by CI.

## DNS and HTTPS

Caddy uses on-demand public TLS and asks the native runtime whether a hostname is provisioned before a certificate can be issued. Public DNS still requires the customer's A/AAAA records to reach the owned edge, and authoritative DNS delegation requires independent external resolver evidence.

CoreDNS is included as the owned authoritative-DNS baseline. Secondary DNS capacity should run in an independent network/failure domain before production delegation is considered complete.

## Security

No customer can execute arbitrary infrastructure commands from the browser. Provisioning is represented as typed jobs and provider adapters. Production secrets are server-side only.

## Status vocabulary

- `planned`
- `queued`
- `running`
- `verified`
- `failed`
- `paused`

A service is not marked live without current verification evidence.
