# HOST NAV Workload API v1

The control-plane API is authenticated with the existing HOST runtime bearer token (`HOST_RUNTIME_TOKEN`). All workload endpoints are under `/api/workloads` and return `Cache-Control: no-store`.

## Request a workload

`POST /api/workloads`

Submit the typed workload specification directly as JSON:

```json
{
  "workloadId": "izakhono-nav",
  "workloadClass": "navigation-platform",
  "logicalNodeId": "NODE01",
  "releaseDigest": "<64-character SHA-256 digest>",
  "healthPath": "/health",
  "internalPort": 8080,
  "idempotencyKey": "<stable unique release request key>"
}
```

Optional `runtimeTargetId` is an opaque HOST binding. It must not identify or rename a physical machine. Omitting it leaves the request unbound.

Responses:
- `202`: a new durable request was recorded in `DATA_DIR/workloads.json`.
- `200`: the same idempotent request already exists; the original record is returned.
- `400`: invalid specification.
- `409`: the idempotency key was reused with different immutable release settings.
- `401`: bearer token missing or invalid.

A successful response explicitly reports `execution: "queued-awaiting-runtime-adapter"` and state `REQUESTED`. This is a persisted request, not proof that a runtime was provisioned or that NAV is running.

## List and inspect

- `GET /api/workloads` — list durable workload records.
- `GET /api/workloads/{recordId}` — retrieve one record.

Both require the HOST runtime bearer token.

## Security and operational boundaries

- The API accepts a typed workload contract, not shell commands, arbitrary compose files, image names or provider credentials.
- Request bodies are size-bounded.
- Records are written atomically with restrictive file permissions.
- Idempotency is serialized within the single HOST control-plane process.
- The runtime worker starts only when `HOST_NAV_RUNTIME_ADAPTER_URL`, `HOST_NAV_RUNTIME_ADAPTER_TOKEN` and `HOST_NAV_RUNTIME_TARGET_ID` are all configured. The data worker has its own independent configuration gate: `HOST_NAV_DATA_ADAPTER_URL` and `HOST_NAV_DATA_ADAPTER_TOKEN`. Both loops run inside the same HOST process as the file-backed stores.
- The runtime worker deploys and independently inspects the immutable release. Once healthy, it automatically queues the South Africa data job. The data worker resumes the five import/acceptance stages and advances the workload to internal `READY` only after service and persistent-data evidence passes.
- No provider is configured by default. Backup/restore execution and public edge activation remain separate acceptance gates.
- Do not promote a record to `READY` or public-live based on request acceptance. Use independent engine, data, routing, search, tile, persistence, backup/restore, HTTPS and DNS evidence.

## NAV South Africa data-import jobs

- `POST /api/workloads/{recordId}/data-imports` queues a durable import job only when the workload has an independently verified runtime deployment and approved `runtime_target_id`.
- `GET /api/nav-data-jobs` lists durable import jobs.
- `GET /api/nav-data-jobs/{jobId}` inspects one job.
- A new job returns `202` and `execution: "queued-awaiting-nav-data-worker"`; idempotent replay returns `200`.
- Requests without verified runtime deployment and target binding return `409`. Browser requests cannot provide adapter names, commands, source credentials or provider settings.
- The worker resumes completed stages after failure, stores stage evidence and retries with bounded backoff. It requires a trusted server-side adapter implementing source fetch, Valhalla graph build, Nominatim import, PMTiles build and service inspection.
- When the runtime worker is enabled with a durable data-job store, it creates the import job automatically after runtime health is independently confirmed. The data worker starts only when its separate adapter URL and server-side token are configured. A manually queued job remains durable while the worker is disabled.
- The JSON store is single-process/single-writer; do not run multiple replicas against the same file. No actual runtime provisioning or data import is claimed until an approved provider binding is configured and the workers complete their evidence gates.
