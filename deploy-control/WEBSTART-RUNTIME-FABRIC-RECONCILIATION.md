# WebStart–Runtime Fabric persistence reconciliation

**Status:** design reconciliation only; no database or infrastructure changes authorized.

## Executive decision

IZAKHONO WebStart is a verified candidate management/control-plane database because its inspected migration history and schema include the IZ DATA Cloud v3 deployment-control model. It is not yet established as the authoritative PostgreSQL database used by Runtime Fabric. Runtime Fabric currently obtains a connection from `IZAKHONO_RUNTIME_DATABASE_URL`; the repository does not establish the provisioned database behind that variable, its owner, its migration runner, or its environment binding.

Therefore, do not add migrations, run DDL, or wire production writes yet. First obtain an owner-verified database identity and prove whether WebStart and Runtime Fabric use the same PostgreSQL database and transaction boundary.

## Evidence-based schema map

| Concern | WebStart control-plane evidence | Runtime Fabric evidence | Reconciliation |
|---|---|---|---|
| Deployment intent | `iz_data.deployment_intents` | `izakhono_runtime_deployments` | Related concepts, but no proven shared key/column contract |
| Deployment artifact/manifest | `iz_data.deployment_manifests` | Runtime deployment `metadata` JSONB | Runtime record lacks first-class immutable artifact and source identity fields |
| Deployment progress | `iz_data.deployment_steps` | Runtime deployment `state`, `checkpoint`, `attempts` | State machines and lifecycle meanings must not be silently equated |
| Health evidence | `iz_data.deployment_health_checks` | Runtime events and deployment state | Evidence ownership, provenance and immutable linkage need a defined contract |
| Verification evidence | `iz_data.deployment_verification_evidence` | No equivalent first-class DEPLOY verification record identified | Keep verification evidence distinct from runtime health or a `LIVE_VERIFIED` state |
| Runtime events | WebStart deployment evidence tables | `izakhono_runtime_events` | Runtime events are operational telemetry, not yet a tenant-attributed DEPLOY security audit ledger |
| Tenant/application/environment | Present in the wider WebStart control-plane model; exact column and constraint mapping remains to be verified | Not first-class in the inspected Runtime Fabric deployment/event tables | Must be explicit, enforced and covered by database constraints |
| Idempotency | Existing root migration `0010_idempotency_claims.sql` is global-keyed and not proven to belong to Runtime Fabric | No DEPLOY transaction-level claim store identified | Do not reuse the global migration as-is |

The WebStart relation names above are based on read-only schema inspection. This document does not assert uninspected column definitions, foreign keys, uniqueness constraints, RLS policies, or cross-database connectivity.

## Runtime Fabric implementation facts

The inspected Runtime Fabric code currently:

- Creates `izakhono_runtime_deployments` and `izakhono_runtime_deployment_leases` through inline SQL in `PostgresDeploymentStore.initialize()`.
- Creates `izakhono_runtime_events` through inline SQL in `PostgresEventStore.initialize()`.
- Opens and commits separate connections for deployment writes and runtime-event appends.
- Uses a deployment primary key of `deployment_id`; the deployment row has workload, state, node, checkpoint, attempts and metadata, but no first-class tenant, application, environment, request hash, approval identity or immutable audit linkage.
- Reads the database DSN from `IZAKHONO_RUNTIME_DATABASE_URL` without proving which provisioned database it identifies.

The Provisioner FORTRESS audit store is not a drop-in transaction participant: its append method commits its supplied connection. Its tenant attribution and secret-field rejection are useful patterns, but its current public append operation cannot be called inside a separate Runtime Fabric transaction without refactoring its transaction ownership.

## Required transaction boundary

The authoritative deployment-control write must have one clearly identified database owner and one transaction boundary. The transaction must cover, as one indivisible commit:

1. Lock and load the deployment record within the authenticated tenant/application/environment scope.
2. Claim the idempotency tuple `(tenant_id, deployment_id, idempotency_key)`.
3. Compare the canonical request hash with any existing claim.
4. Validate the requested transition using the DEPLOY lifecycle policy.
5. Persist the new deployment state and immutable evidence.
6. Append an attributable, immutable audit event containing the verified actor and resource scope.
7. Persist the replayable response/result associated with the idempotency claim.

Any failure before commit must roll back all seven effects. A committed state transition without its audit event, or an audit event without its corresponding state transition, is unacceptable.

### Idempotency semantics

- Scope keys at minimum by tenant, deployment and idempotency key; application and environment must also be bound to the deployment identity and checked on every operation.
- Persist a canonical request hash, not only the key.
- Same scope + same key + same hash: return the original committed result without applying the transition again or duplicating the audit event.
- Same scope + same key + different hash: reject as an idempotency conflict; do not mutate state or append a success event.
- Concurrent claims must serialize through a database uniqueness constraint and transaction-safe conflict handling.
- Do not expose raw secrets in request hashes, stored evidence, audit payloads or logs. Use safe canonicalization and secret references where needed.

## Critical same-database decision

A normal PostgreSQL transaction cannot atomically commit rows in two independent databases merely because both are PostgreSQL or because both are reachable by the same application.

**If WebStart and Runtime Fabric resolve to the same authoritative database and can share one connection/transaction**, implement the deployment record, idempotency claim and audit event within that transaction, using the owner-approved schema and migration path.

**If they are separate databases**, designate one as the authoritative transactional owner for deployment state, idempotency and audit. Use a transactional outbox in that same database to publish committed changes to the other system, with an idempotent consumer and reconciliation/retry visibility. Do not describe a dual-write or two independent commits as atomic. The owner must explicitly approve which system is authoritative before implementation.

Runtime Fabric operational events may be downstream projections/telemetry. They must not be represented as the authoritative DEPLOY security audit unless their schema, actor attribution, immutability and transaction coupling satisfy the audit contract.

## Authorization and isolation contract

The existing `deploy-control/authorization.mjs` policy module verifies a bearer token through an injected trusted verifier, checks issuer/audience/expiry and required tenant/application/environment/scope claims, and rejects fabricated principal objects. It is a policy boundary, not a production identity integration.

Before any deployment read or write:

- Verify the token using an owner-approved IZAKHONO ID/FORTRESS verifier and a dedicated DEPLOY audience.
- Derive tenant, application, environment and actor identity from the verified principal, never from browser-supplied authority fields.
- Authorize the exact deployment resource and action before querying or mutating it.
- Include tenant scope in every persistence query and mutation; do not fetch globally by deployment ID and authorize afterwards.
- Enforce database constraints that prevent a deployment or idempotency claim from crossing tenant/application/environment boundaries.
- Keep read, write and approval scopes distinct.
- Fail closed when identity verification, entitlement resolution, database binding or resource scope is unavailable.

The inspected Creator token contract is not automatically compatible: its audience and claims do not establish DEPLOY application/environment entitlements. Do not accept Creator tokens as DEPLOY authority or infer resource permissions from a role name.

## Migration and implementation gates

No schema migration or live database change is authorized until all of the following are evidenced:

1. Named owner for the authoritative database, provisioning path, migration runner and rollback procedure.
2. Verified database identity and environment-to-database binding for WebStart and Runtime Fabric.
3. Explicit decision on same-database transaction versus authoritative-store plus outbox.
4. Approved schema mapping, including tenant/application/environment foreign keys or equivalent constraints, request-hash storage, immutable audit linkage and uniqueness rules.
5. Approved identity issuer, DEPLOY audience, signing-key trust/rotation, live-session or revocation semantics, and application/environment entitlement source.
6. A reviewed RLS/grant/function privilege plan for affected tables and APIs; no bulk RLS or grant changes.
7. PostgreSQL integration tests against the approved schema and transaction boundary.

## Required acceptance tests

The implementation is not ready for an authenticated write API until PostgreSQL-backed tests prove:

- State + idempotency claim + audit event commit together.
- An injected failure at each write stage rolls back every effect.
- Exact replay returns the original result and creates no duplicate transition/audit event.
- Same key with a different canonical request hash is rejected without mutation.
- Concurrent identical claims produce one committed transition.
- Concurrent conflicting claims cannot both succeed.
- Cross-tenant, cross-application and cross-environment reads and writes are denied.
- Authorization failure occurs before data access/mutation.
- Audit actor and resource scope come from the verified principal.
- Audit records cannot be updated or deleted by the application write path.
- Secret-bearing evidence and audit fields are rejected.
- Outbox delivery (if required) is retryable and idempotent, with observable dead-letter/reconciliation state.

Mock-only cursor tests are not sufficient for transaction, isolation, concurrency or RLS guarantees.

## Explicitly unchanged

This reconciliation is repository documentation only. It does not execute SQL, add or apply migrations, inspect or alter live permissions, change RLS, register runners, access HOST, run bootstrap, change DNS, disconnect Vercel, merge the PR, or deploy production.

NODE01 remains the logical software-runtime identity. A verified, replaceable HOST/runtime binding and authorized execution interface remain separate deployment gates.
