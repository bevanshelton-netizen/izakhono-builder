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
- The runtime worker module and lease/evidence primitives exist but are not started as an always-on service. No concrete runtime adapter or target is registered. Data-import jobs, service startup, backup/restore execution and public edge activation are not yet connected.
- Do not promote a record to `READY` or public-live based on request acceptance. Use independent engine, data, routing, search, tile, persistence, backup/restore, HTTPS and DNS evidence.

## NAV South Africa data-import jobs

- `POST /api/workloads/{recordId}/data-imports` queues a durable import job only when the workload is in `PROVISIONING`, has an approved `runtime_target_id`, and carries the independently recorded `runtime-deployed-awaiting-data-pipeline` execution stage.
- `GET /api/nav-data-jobs` lists durable import jobs.
- `GET /api/nav-data-jobs/{jobId}` inspects one job.
- A new job returns `202` and `execution: "queued-awaiting-nav-data-worker"`; idempotent replay returns `200`.
- Requests without verified runtime deployment and target binding return `409`. Browser requests cannot provide adapter names, commands, source credentials or provider settings.
- The worker resumes completed stages after failure, stores stage evidence and retries with bounded backoff. It requires a trusted server-side adapter implementing source fetch, Valhalla graph build, Nominatim import, PMTiles build and service inspection.
- The worker and file-backed job store are packaged, but no import adapter is registered and no worker loop is started. The JSON store is single-process/single-writer; do not run multiple replicas against the same file. No actual data import is claimed.
