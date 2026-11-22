# IZAKHONO Owned Worker Gateway v1

Standalone, provider-neutral worker ingress for the IZAKHONO owned runtime. It is deliberately separate from the existing `izakhono-gateway`, `social-command-worker`, payment and identity functions.

## Contract

- `GET /healthz`: process liveness.
- `GET /readyz`: database reachability only.
- `POST /v1/worker/heartbeat`: authenticate a worker credential.
- `POST /v1/jobs/claim`: atomically claim one due job for the credential's tenant and worker key.
- `POST /v1/jobs/:id/heartbeat`: renew a live lease.
- `POST /v1/jobs/:id/complete`: persist a result against a live lease.
- `POST /v1/jobs/:id/fail`: retry with bounded backoff or terminally fail.

All worker routes require an opaque bearer token. Only its SHA-256 digest is stored. Authentication resolves tenant, worker identity and capabilities server-side. Database operations set a transaction-local tenant context and RLS policies independently enforce tenant scope. Claims use `FOR UPDATE SKIP LOCKED`; lease tokens are random, hashed at rest, and expire. Retries are bounded by each job's `max_attempts`.

## Isolation from existing services

This service uses new `owned_worker_*` tables only. It does not read, update, claim, or replay `public.iz_worker_jobs`. It does not call or replace any Supabase Edge Function. No payment, identity, publishing, customer-message, provisioning or external-spend adapter is included.

## Private artifacts

No artifact object or bucket is made public. This first version does not mint signed URLs or proxy object bytes. Artifact delivery remains blocked until the private bucket name, object ownership metadata and tenant-to-job authorization contract are explicitly verified. Store only private object references in job results; never place service-role credentials or public object URLs in payloads.

## Configuration

- `OWNED_WORKER_DATABASE_URL`: connection string for a dedicated login role that is a member of `owned_worker_gateway`; do not use the broad Supabase service-role credential.
- `PORT` (default `8790`), `HOST` (default `127.0.0.1`).
- `WORKER_LEASE_SECONDS` (30–900; default 120).
- `DB_POOL_MAX` (default 5).

The migration creates a NOLOGIN group role. An operator must provision a dedicated database login secret out-of-band and grant it membership in that role. Do not commit credentials.

## Migration and promotion gates

1. Review and apply `supabase/migrations/20261122120000_owned_worker_gateway_v1.sql` only through the approved database change process.
2. Provision the restricted DB login and seed a tenant-scoped worker credential using a secure operator process. The plaintext token is shown only once to the operator; only its digest is stored.
3. Run unit and integration tests against a disposable tenant/test database.
4. Verify tenant A cannot claim, renew, complete or read tenant B jobs; verify revoked/expired credentials fail.
5. Verify retry limits, lease expiry, duplicate claims and audit events.
6. Deploy to an authorized IZAKHONO NODE after host identity, capacity and runner access are verified.

No deployment is performed by this repository change. NODE01 remains a logical runtime identity until a real authorized node reports health evidence.
