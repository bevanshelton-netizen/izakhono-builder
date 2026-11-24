# DEPLOY PostgreSQL transaction adapter

## Implementation

`postgres-adapter.mjs` adapts a trusted node-postgres Pool to the existing
`transitionDeploymentAtomically()` contract. It checks out one client and
uses that same connection for BEGIN, tenant/application/environment-scoped
deployment row locking, idempotency lookup/update, deployment metadata update,
FORTRESS audit append, and COMMIT. Any failure rolls back the entire transaction.

The adapter deliberately reuses the existing Runtime Fabric
`izakhono_runtime_deployments` table and the existing
`fortress_audit_events` table. It does not create tables, read a DSN, initialize
a store, run migrations, change grants/RLS, or select a production database.
The Runtime Fabric deployment row lock serializes operations for one
deployment; idempotency records are stored under a SHA-256 digest of the
idempotency key inside the deployment's `metadata.deploy_control` JSON object.
Only the digest, request hash and replayable response are persisted. The
Runtime Fabric `PostgresDeploymentStore.put()` upsert preserves this reserved
subdocument and the tenant/application/environment binding fields when it
updates ordinary runtime metadata. A real PostgreSQL regression verifies that
preservation.

## Disposable PostgreSQL integration tests

`postgres.integration.test.mjs` creates the two existing table shapes in a
dedicated local disposable database named `deploy_control_test`. It tests:

- Deployment state, idempotency response and FORTRESS audit commit together.
- Exact replay returns the original result without a duplicate audit event.
- Reuse of a key with a different canonical request hash is rejected.
- An injected FORTRESS audit failure rolls back deployment and idempotency
  metadata.
- Concurrent identical requests serialize to one transition and one replay.
- Concurrent conflicting requests cannot both mutate the deployment.
- Tenant/application/environment scope is enforced by the row lookup.

Run against a disposable local PostgreSQL instance only:

```sh
npm install --no-save --ignore-scripts --no-audit --no-fund pg@8.16.3
DEPLOY_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/deploy_control_test \
  node --test deploy-control/postgres.integration.test.mjs
```

The test refuses non-local hosts and any database name other than
`deploy_control_test`. It truncates only the two test tables and never reads a
production environment variable. Without `DEPLOY_TEST_DATABASE_URL`, tests
are explicitly skipped.

## Release boundary

This is a concrete adapter implementation against the inspected existing
Runtime Fabric/FORTRESS table contracts, not approval to wire production writes.
The adapter assumes the two tables resolve to the same PostgreSQL database.
That identity and shared transaction boundary are not yet verified. It also
uses tenant/application/environment identifiers in deployment metadata because
the existing Runtime Fabric table has no first-class columns for them; database
constraints and RLS isolation are not thereby proven.

Before production wiring, the accountable database owner must approve the
authoritative database, environment binding, metadata/schema mapping, migration
runner, rollback, privilege/RLS model and whether this is the authoritative
DEPLOY transaction boundary. If WebStart and Runtime Fabric are separate
databases, choose one authoritative owner and use a transactional outbox in
that database; do not dual-write and claim atomicity. The FORTRESS audit append
must remain inside the caller's transaction; do not call the existing
`FortressAuditStore.append()` method because it commits its connection.


## Database binding preflight

`infra/runtime-fabric/controller/database_preflight.py` is the read-only operator-side companion. With `IZAKHONO_RUNTIME_DATABASE_URL` supplied through the host secret manager, it checks both existing tables and their required columns over one `BEGIN READ ONLY` connection. It never prints the DSN and always reports `production_authorized: false`. A technical pass still requires separate owner attestation and does not prove migration authority, RLS/grants or audit immutability.
