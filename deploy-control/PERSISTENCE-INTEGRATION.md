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

## Important compatibility gaps

The Runtime Fabric deployment record currently has `deployment_id`, `workload`, `state`, `node`, `checkpoint`, `attempts`, and JSON metadata. It does not expose first-class tenant, application, environment, source SHA, immutable artifact digest, approval identity, or idempotency request hash fields.

Its state machine (`CREATED`, `PLANNED`, `ACTIVATING`, `DEPLOYED`, `HEALTH_CHECKING`, `ACCEPTANCE_PENDING`, `READY_FOR_PROMOTION`, `LIVE_VERIFIED`, rollback states) is not identical to DEPLOY's policy lifecycle. Do not silently map one state machine onto the other or treat `LIVE_VERIFIED` as equivalent to DEPLOY `VERIFIED`.

The deployment store and event store currently commit independently. That is insufficient for DEPLOY's requirement that state, idempotency claim, and immutable audit event commit atomically. A new adapter must use one PostgreSQL transaction/connection for all three operations, with tenant-scoped uniqueness and request-hash conflict detection.

## Required next implementation gate

1. Verify the authoritative PostgreSQL schema/migration owner and connection contract for Runtime Fabric.
2. Extend the existing store contract, not create another store, to persist DEPLOY's full immutable record and event evidence.
3. Add a transaction method that atomically locks the deployment row, claims `(tenant_id, deployment_id, idempotency_key)`, compares the canonical request hash, applies the lifecycle policy, and appends the audit event.
4. Reject key reuse with a different request body; return the prior result for an exact replay.
5. Enforce tenant/application/environment authorization before reading or mutating any record. The existing business-engine `dbFetch` service-role helper is not end-user authorization and must not be exposed as a browser-facing control-plane API.
6. Reject secret-bearing audit/evidence fields and store secret references only.
7. Keep the management API read-only until the transaction, authorization, isolation, and audit tests pass.

## Validation observed on 2026-11-22

For PR head `250e4710f1fe00223adceb62cc1067299ae622e0`, GitHub Actions reported successful completion of:

- IZAKHONO DEPLOY lifecycle CI (run 7)
- NODE01 Architecture Invariant (run 2845)

These are repository CI results only. They do not establish that a PostgreSQL service, owner runtime, HOST execution access, or production deployment is available.

## NODE01 and execution boundary

Preserve `logical_node_id: NODE01` and `identity_type: software-runtime`. A verified `runtime_host` is a separate, replaceable execution-environment binding. Do not infer or invent that locator. No activation/bootstrap, deployment command, or HOST execution is authorized by this persistence work.
