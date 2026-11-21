# J.A.R.V.I.S. owned-runtime operations

## Implemented source boundary

- Node.js 22 HTTP API using the existing J.A.R.V.I.S. workforce and executive snapshot route modules.
- PostgreSQL adapter for the reviewed D1-shaped route contract, with explicit translation for positional parameters, SQLite `datetime()`, and dependency JSON iteration.
- Transactional, checksum-recorded PostgreSQL schema installer. It is an explicit operator command and is never invoked during API startup.
- Separate owner API and workforce service credentials are required (minimum 32 bytes each) and compared in constant time. Worker tokens are limited to claim, heartbeat, completion and failure routes; owner-only queue review and approval remain protected by the owner secret. The service has no public CORS policy.
- Readiness verifies PostgreSQL connectivity and the workforce schema; liveness is independent of database availability.
- API request bodies are capped at 64 KiB. PostgreSQL connections use TLS verification by default; disable only for an explicitly isolated local development database.
- Existing owner review remains mandatory. This runtime does not connect or activate an executor or autonomous workers.

## Build and test

From the repository root:

```sh
node products/izakhono-jarvis/runtime/db.test.mjs
docker build -f products/izakhono-jarvis/runtime/Dockerfile -t izakhono-jarvis-api:local .
```

## Explicit schema installation

Use a dedicated, least-privilege database role with DDL permissions only for the installation window. Confirm the database endpoint is an IZAKHONO-owned PostgreSQL instance, take and verify a backup, and review the SQL before installation.

```sh
JARVIS_ALLOW_SCHEMA_MIGRATION=1 \
DATABASE_URL='postgresql://<role>:<secret>@<owned-db-host>:5432/<database>' \
DATABASE_SSLMODE=verify-full \
node --experimental-strip-types products/izakhono-jarvis/runtime/postgres-migrate.mjs
```

The installer takes a PostgreSQL advisory transaction lock, applies the schema and records a SHA-256 checksum in one transaction. It refuses to overwrite a previously installed migration with a different checksum. It does not import or alter existing D1 data.

## API runtime

Provide `DATABASE_URL`, `JARVIS_OWNER_SECRET` and a separate `JARVIS_WORKER_TOKEN` through the IZAKHONO FORTRESS secret store at runtime. Do not put credentials in source control, images, compose files or command-line history. Both tokens must be at least 32 bytes. The worker token must never be the owner secret. Use a dedicated application role with only the required table privileges; do not run the API as a database owner or superuser.

```sh
DATABASE_URL='postgresql://<app-role>:<secret>@<owned-db-host>:5432/<database>' \
JARVIS_OWNER_SECRET='<owner-secret-from-FORTRESS>' \
JARVIS_WORKER_TOKEN='<separate-worker-token-from-FORTRESS>' \
DATABASE_SSLMODE=verify-full \
node --experimental-strip-types products/izakhono-jarvis/runtime/server.mjs
```

Bind the service only to the private HOST/Runtime Fabric service network. Publish no host port directly. Caddy/EDGE must route only the approved API paths over the private network with TLS at the edge. Do not expose PostgreSQL, supervisor or executor services publicly.

## Release state

This source implementation advances the code to `RUNTIME_ADAPTER_IMPLEMENTED`; the SQL adapter and workforce claim-to-owner-review lifecycle pass against disposable PostgreSQL 17 in CI. This is not a claim of production database migration, a verified host deployment, or a live J.A.R.V.I.S. service. Production activation remains blocked pending a real PostgreSQL integration run, privilege review, backup/restore proof, verified owned host, FORTRESS secret provisioning, EDGE/TLS checks, and owner acceptance. No executor or worker service is started by this release.
