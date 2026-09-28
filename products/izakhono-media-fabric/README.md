# IZAKHONO MEDIA RUNTIME FABRIC

Durable, owner-first job control for long-running image, video, speech and transcription work.

This service sits behind IZAKHONO SUPER AI. It is not another model provider. It is the queue, lease, worker and artifact layer that lets multiple IZAKHONO products share GPU/CPU capacity without making one application or one machine the runtime authority.

## What it provides

- durable SQLite/WAL job queue;
- AES-GCM encrypted job payloads at rest;
- expiring worker leases and automatic requeue after worker loss;
- bounded retry attempts with exponential backoff;
- worker registration and heartbeats;
- hardware-aware job claiming using available GPU memory;
- capability-aware scheduling;
- artifact ingestion with SHA-256 evidence;
- private artifact serving;
- opaque per-job polling token;
- no prompt/body logging;
- no behavioural telemetry or advertising identifiers;
- no external model routing.

## Architecture

```text
IZAKHONO PRODUCTS
      |
      v
IZAKHONO SUPER AI
      |
      +-- immediate speech/video -> owner runtime
      |
      +-- durable media job -> MEDIA RUNTIME FABRIC
                                  |
                         encrypted durable queue
                                  |
                 +----------------+----------------+
                 |                |                |
              NODE01           NODE02          approved worker
              worker           worker              ...
                 |                |
          local speech/video  local speech/video
                 +--------+-------+
                          |
                   artifact store
```

Workers never receive another platform's runtime credentials through a job. Runtime secrets stay machine-local. The broker decrypts a job only when an authorized worker claims it. Worker logs intentionally omit payload content.

## State boundary

SQLite is used as a compact durable broker store. **Local disk is not considered production-HA state.**

`/healthz` reports `production_ready:true` only when:

1. the broker database, internal key and payload-encryption key are healthy;
2. `IZAKHONO_MEDIA_FABRIC_REPLICATED_STORAGE=true`; and
3. at least one healthy worker is registered.

For the owned k3s target, place `/var/lib/izakhono/media-fabric` on the approved replicated storage class. For a standalone runtime, keep the flag false and treat the broker as durable-but-not-HA.

This preserves the Runtime Fabric rule that NODE01 is not the sole authority.

## Broker API

All private API calls require `x-izakhono-media-fabric-key`.

### Submit

`POST /api/v1/jobs`

```json
{
  "schema": "izakhono.media.job.submit.v1",
  "capability": "video",
  "payload": {
    "schema": "izakhono.video.scene.v1",
    "prompt": "Animate this original character.",
    "source_image": "data:image/png;base64,...",
    "duration_seconds": 7,
    "aspect_ratio": "9:16",
    "policy": {
      "owned_first": true,
      "no_tracking": true,
      "originality_required": true
    }
  },
  "priority": 60,
  "max_attempts": 3,
  "min_gpu_mb": 12000,
  "policy": {
    "owned_first": true,
    "no_tracking": true
  }
}
```

The submission returns an opaque job ID plus a one-time-visible `job_token`. Polling requires both the broker key and `x-izakhono-job-token`.

### Worker lifecycle

- `POST /api/v1/workers/register`
- `POST /api/v1/workers/<id>/heartbeat`
- `POST /api/v1/workers/<id>/claim`
- `POST /api/v1/jobs/<id>/lease`
- `PUT /api/v1/artifacts/<job>/<name>`
- `POST /api/v1/jobs/<id>/complete`
- `POST /api/v1/jobs/<id>/fail`

A running job whose lease expires is requeued if attempts remain. That is the resumability boundary: work restarts from the immutable queued payload and already committed artifacts remain auditable.

## NODE installation

Broker:

```bash
sudo bash products/izakhono-media-fabric/install-broker.sh
```

Local worker:

```bash
sudo bash products/izakhono-media-fabric/install-worker.sh
```

Verification:

```bash
sudo bash products/izakhono-media-fabric/verify-node.sh
```

A remote owned worker uses a root-only `/etc/izakhono/apps/izakhono-media-fabric.env` containing the approved private/HTTPS broker URL and broker credential. Worker transport must remain on an owner/private network or approved HTTPS route.

## Scheduling

Workers publish capabilities and current GPU evidence. The broker only leases jobs that:

- match the worker capability;
- fit `min_gpu_mb` against current free/total GPU memory;
- are due for execution;
- have retry attempts remaining; and
- fit the worker's declared concurrency.

Higher priority runs first, then oldest queued work.

The first worker implementation executes the native IZAKHONO Speech Runtime and Video Runtime. Image and transcription are reserved in the capability schema for their owned workers.

## Artifact integrity

Workers upload generated artifacts back to the fabric. The broker stores byte size and SHA-256 and returns an internal asset URL. Completed job results are encrypted in the queue database.

Artifacts are generated content and are not placed in Git.

## Production truth

CI can prove queue logic, encryption, scheduling, retry and installer syntax. It cannot prove real disks are replicated, a GPU exists, or a remote worker is reachable. Those are runtime evidence gates. Do not describe the fabric as production-HA until `/healthz` returns `production_ready:true` on an approved runtime.
