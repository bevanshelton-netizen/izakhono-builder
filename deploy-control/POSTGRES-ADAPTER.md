# DEPLOY PostgreSQL transaction adapter

## What is implemented

`postgres-adapter.mjs` adapts a trusted node-postgres Pool to the existing
`transitionDeploymentAtomically()` contract. One checked-out client is used
for BEGIN, scoped deployment row locking, idempotency claim/replay handling,
deployment update, audit append, idempotency-result completion, and COMMIT.
Any callback or SQL failure triggers ROLLBACK before the client is released.

The adapter intentionally does not import or construct a Pool, read a DSN,
create tables, run migrations, change grants/RLS, or select a production
database. The caller must supply a Pool and an explicit schema name.

## SQL contract exercised by integration tests

The disposable integration fixture defines three tables in a unique temporary
schema:

- `deployment_records`: deployment JSON plus tenant/application/environment
  ownership columns and a scoped unique key.
- `idempotency_claims`: unique (tenant, deployment, idempotency key), canonical
  request hash, claim ID and replayable response.
- `audit_events`: immutable-by-application event rows with actor and complete
  resource scope.

The unique idempotency constraint serializes concurrent claims. A second
transaction waits for the first insert to commit, then locks and compares the
stored request hash. Identical requests replay the stored response; a different
hash is rejected. No committed incomplete claim is accepted as a replay.

## Run locally

Use only a disposable local PostgreSQL database named `deploy_control_test`:

```sh
npm install --no-save --ignore-scripts --no-audit --no-fund pg@8.16.3
DEPLOY_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/deploy_control_test \
  node --test deploy-control/postgres.integration.test.mjs
```

Without `DEPLOY_TEST_DATABASE_URL`, the integration tests are explicitly
skipped. When supplied, the test refuses non-local hosts or a database name
other than `deploy_control_test`, creates a unique schema, and drops only that
schema on completion.

## Security and release boundary

This is a concrete adapter and disposable-schema integration contract, not an
approved production persistence rollout. The fixture is not a production
migration. It does not prove RLS policies, grants, audit immutability against
privileged database roles, identity-provider integration, or the mapping to
WebStart/Runtime Fabric's live database.

Before production wiring, the accountable database owner must approve the
authoritative database, environment binding, schema mapping, migration runner,
rollback, privilege/RLS model and whether the authoritative transaction is
WebStart or Runtime Fabric. If they are separate databases, use an outbox in
the owner-selected authoritative database; do not dual-write and claim atomicity.
