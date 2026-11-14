# IZAKHONO Compute Manager

Private, provider-neutral control service for registering worker capacity and scheduling bounded compute jobs.

## Services

- `compute-manager`: authenticated HTTP API, persistent queue, worker registry, leases and audit events.
- `compute-worker`: non-privileged polling worker. It runs only the built-in allow-listed task types; it never executes arbitrary shell commands or user-supplied code.

## API

Administrator bearer token:
- `GET /health`
- `GET /api/compute/summary`
- `GET /api/compute/nodes`
- `GET /api/compute/jobs`
- `GET /api/compute/jobs/:id`
- `GET /api/compute/audit`
- `POST /api/compute/jobs` with `{ "type": "health-check|sha256|echo", "input": {}, "priority": 0 }`

Worker bearer token:
- `POST /worker/register`
- `POST /worker/claim`
- `POST /worker/jobs/:id/complete`
- `POST /worker/jobs/:id/fail`

## Run locally

Node.js 22+:
```sh
COMPUTE_ADMIN_TOKEN='replace-with-secret' COMPUTE_WORKER_TOKEN='replace-with-another-secret' DATA_DIR=./data node server.mjs
```
In another process:
```sh
COMPUTE_MANAGER_URL=http://127.0.0.1:8082 COMPUTE_WORKER_TOKEN='replace-with-another-secret' node ../worker/worker.mjs
```

Run smoke test:
```sh
node smoke.mjs
```

## Security and current boundaries

- Manager and worker endpoints require separate bearer credentials.
- The worker has no Docker socket, host mounts, shell execution, or dynamic code execution.
- Job input is size-limited; queue length is bounded; leases expire and return jobs to the queue.
- Production persistence uses the owned PostgreSQL database and a transactional row lock, so multiple manager instances cannot claim the same queued lease concurrently. A local JSON-file adapter remains available for isolated smoke tests only.
- The compute state is currently stored as a single JSONB aggregate row. This is durable and transactionally serialized, but should be normalized into indexed node/job/audit tables as queue volume grows.
- Job resource requests include bounded CPU and memory requirements; workers advertise available capacity. Lease expiry is retried up to five times before the job is failed.
- Built-in tasks prove end-to-end scheduling only. Production app builds, sandboxed code execution, GPU scheduling and provider provisioning require dedicated isolated adapters and must not be enabled by passing arbitrary commands to this worker.
- Keep manager port 8082 private; do not publish it through public edge routing. Use an authenticated private operator tunnel/network.
