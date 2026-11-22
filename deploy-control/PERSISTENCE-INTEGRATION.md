# IZAKHONO DEPLOY persistence integration decision

## Decision

DEPLOY must extend the existing Runtime Fabric PostgreSQL deployment store and append-only event store. It must not introduce a second deployment database, registry, audit ledger, or parallel idempotency subsystem.

The existing implementation points are:

- `infra/runtime-fabric/controller/postgres_deployment_store.py`: durable deployment rows and atomic per-deployment recovery leases.
- `infra/runtime-fabric/controller/postgres_event_store.py`: append-only runtime events.
- `infra/runtime-fabric/controller/runtime_store_factory.py`: lazy PostgreSQL connection factory using `IZAKHONO_RUNTIME_DATABASE_URL`, failing closed when unavailable.
- `infra/provisioner/fortress_audit_store.py`: tenant-attributed append-only audit pattern, secret-field rejection, and duplicate-event handling.
- `infra/provisioner/idempotency_tenant_scope_test.py`: tenant-scoped idempotency invariant.
- `migrations/0010_idempotency_claims.sql`: existing idempotency-claim contract. Its actual database/runtime ownership must be verified before reuse; do not assume it is the PostgreSQL Runtime Fabric store.

## Schema ownership investigation (2026-11-22)

The repository inspection does **not** establish an authoritative, versioned PostgreSQL migration owner for Runtime Fabric:

- Runtime Fabric deployment and event tables are currently declared as inline `CREATE TABLE IF NOT EXISTS` statements in the Python stores and created by their `initialize()` methods.
- The shared root `migrations/` sequence is not evidence of Runtime Fabric PostgreSQL ownership. For example, `migrations/0001_init.sql` defines Builder project tables, while `migrations/0022_builder_customer_tenancy.sql` uses SQLite-specific `PRAGMA` and SQLite schema conventions.
- `migrations/0010_idempotency_claims.sql` has a global primary key and text timestamps, but no tenant/deployment scope. It is not a safe drop-in for the Runtime Fabric transaction.
- `runtime_store_factory.py` reads `IZAKHONO_RUNTIME_DATABASE_URL` and constructs a psycopg connection factory, but repository code inspected here does not prove which provisioned database that variable points to, who owns its migrations, or whether its schema is shared with Provisioner/FORTRESS.

**Result:** do not add a DEPLOY migration to the root migration sequence or modify the live PostgreSQL schema until the Runtime Fabric database owner, provisioning path, migration runner, and environment-to-database binding are explicitly established. The current runtime-created tables remain the only verified Runtime Fabric schema path in code.

## Important compatibility gaps

The Runtime Fabric deployment record currently has `deployment_id`, `workload`, `state`, `node`, `checkpoint`, `attempts`, and JSON metadata. It does not expose first-class tenant, application, environment, source SHA, immutable artifact digest, approval identity, or idempotency request hash fields.

Its state machine (`CREATED`, `PLANNED`, `ACTIVATING`, `DEPLOYED`, `HEALTH_CHECKING`, `ACCEPTANCE_PENDING`, `READY_FOR_PROMOTION`, `LIVE_VERIFIED`, rollback states) is not identical to DEPLOY's policy lifecycle. Do not silently map one state machine onto the other or treat `LIVE_VERIFIED` as equivalent to DEPLOY `VERIFIED`.

The deployment store and event store currently commit independently. That is insufficient for DEPLOY's requirement that state, idempotency claim, and immutable audit event commit atomically. A new adapter must use one PostgreSQL transaction/connection for all three operations, with tenant-scoped uniqueness and request-hash conflict detection.

The existing Provisioner PostgreSQL store is not a drop-in substitute: `provisioner_jobs` has `UNIQUE (tenant_id, idempotency_key)` but no canonical request hash, and its job save, local audit append, and FORTRESS mirror each commit separately. `migrations/0010_idempotency_claims.sql` defines a globally unique `key` and text timestamps/response, with no tenant/deployment scope; it cannot be assumed safe for DEPLOY without proving its owning database and migration runtime. The FORTRESS audit table includes tenant attribution, but its append method commits its supplied connection and therefore cannot currently participate atomically in a separate Runtime Fabric transaction. The existing tenant-scope unit test proves an in-memory Provisioner invariant only, not PostgreSQL isolation or authorization.

The Runtime Fabric event store is also not yet a DEPLOY audit ledger: its event rows have no tenant/application/environment or authenticated actor columns, and its public append method opens and commits its own connection. DEPLOY must not treat a normal runtime event as an attributable, transactionally coupled security audit event.

## Required next implementation gate

1. Verify the authoritative PostgreSQL schema/migration owner, provisioning path, migration runner, and connection contract for Runtime Fabric.
2. Extend the existing Runtime Fabric store contract, not create another deployment database, to persist DEPLOY's full immutable record and event evidence.
3. Add a transaction method that uses one connection and transaction to lock the deployment row, claim `(tenant_id, deployment_id, idempotency_key)`, compare the canonical request hash, apply the lifecycle policy, and append the attributable audit event.
4. Reject key reuse with a different request body; return the prior result for an exact replay.
5. Enforce tenant/application/environment authorization from a verified authenticated principal before reading or mutating any record. The existing business-engine `dbFetch` service-role helper is not end-user authorization and must not be exposed as a browser-facing control-plane API.
6. Reject secret-bearing audit/evidence fields and store secret references only.
7. Add PostgreSQL integration tests for transaction rollback, exact replay, conflicting replay, cross-tenant isolation, authorization failure, immutable audit, and concurrent claims. Mock-only cursor tests are not sufficient for these guarantees.
8. Keep the management API read-only until the transaction, authorization, isolation, and audit tests pass.

## Validation observed on 2026-11-22

For the latest PR head `d84213cac6e64643a350cefdee3c79c63590ba75`, GitHub Actions reported successful completion of all four workflows:

- IZAKHONO DEPLOY lifecycle CI (run 11)
- NODE01 Architecture Invariant (run 2851)
- IZAKHONO Application Manifest Validation (run 1712)
- IZAKHONO Builder CI (run 5825)

These are repository CI results only. They do not establish that a PostgreSQL service, owner runtime, HOST execution access, or production deployment is available.

## NODE01 and execution boundary

Preserve `logical_node_id: NODE01` and `identity_type: software-runtime`. A verified `runtime_host` is a separate, replaceable execution-environment binding. Do not infer or invent that locator. No activation/bootstrap, deployment command, or HOST execution is authorized by this persistence work.
