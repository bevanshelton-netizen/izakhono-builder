# THOR Control Plane deployment contract

The Worker API is deployable code, but this repository does not contain a provisioned Cloudflare account, D1 database ID or production secrets. Do not deploy until those resources are created and approved.

## Required resources

1. A dedicated Cloudflare D1 database owned by IZAKHONO for THOR only.
2. A Worker named `izakhono-thor-control-plane`.
3. A 32-byte-or-stronger API token; store only its SHA-256 hex digest in `THOR_API_TOKEN_SHA256`.
4. One independently generated worker token per worker ID; store the JSON map of worker IDs to SHA-256 digests in `THOR_WORKER_TOKEN_HASHES`.
5. A `THOR_PROJECT_POLICIES` JSON map. Each project policy must specify `repository`, `baseRef`, `workRefPrefix`, `allowedPaths`, `commands`, `limits`, and optionally `maxAttempts`.
6. `THOR_LEASE_MS` between 1000 and 900000 milliseconds.

## Provision and deploy

After the account and database are authorized:

1. Create the dedicated D1 database and record its real database ID.
2. Copy `wrangler.toml.example` to `wrangler.toml`; replace the database ID and review the Worker name and compatibility date.
3. Apply migrations in order:
   `wrangler d1 migrations apply thor-control-plane --remote`.
4. Set `THOR_API_TOKEN_SHA256` and `THOR_WORKER_TOKEN_HASHES` with `wrangler secret put`.
5. Set the project policy map as a protected Worker variable/secret. Never put raw tokens in the repository.
6. Run `wrangler deploy` only after the D1 schema and policy configuration are verified.
7. Confirm `GET /health` returns 200 and `GET /ready` returns 200 with all four checks true.
8. Run a non-production canary task with a dedicated test repository and worker token. Verify claim, heartbeat, lease expiry, failure/retry, completion evidence and cancellation.

## Hard boundary

This Worker stores task state and coordinates worker leases. It does not execute code, create repository branches, or deploy products. Production coding tasks remain disabled until the Docker sandbox runner is integrated into a continuously running worker, the repository-token broker and model adapter are implemented, GitHub commit/PR evidence is independently verified, and the full worker path passes independent security tests. Do not point it at customer repositories or production projects before those gates pass.
