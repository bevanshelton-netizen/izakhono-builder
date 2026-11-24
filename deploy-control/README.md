# IZAKHONO DEPLOY

IZAKHONO DEPLOY is the owned-first application delivery and runtime control plane. It extends the existing IZAKHONO BUILDER, NODE01-SW, IZAKHONO CONTROL, and PROVISIONER foundations; it is not a second hosting stack.

## Cost and independence principles

- No required paid AI builder, AI API, inference token, or usage-credit account.
- No runtime dependency on Vercel, Render, or another proprietary PaaS.
- Prefer open-source components and the existing owner-controlled execution capacity.
- The platform still consumes real compute, electricity, network bandwidth, storage, backups, and potentially domain/ISP services. "No credits or tokens" does not mean zero operating cost.
- CI may use GitHub-hosted runners only as an optional convenience; production execution remains portable and owner-controlled.

## Existing architecture to reuse

- IZAKHONO BUILDER: source/build workflow and product orchestration.
- NODE01-SW: portable software-runtime identity and workspace/job foundation.
- IZAKHONO CONTROL: owner operations and policy boundary.
- IZAKHONO EDGE: ingress, TLS, routing and rate controls.
- Existing registry/provisioner and shared database contracts where appropriate.

Do not create a second NODE01 identity, duplicate registry, second finance ledger, or parallel application database.

## Deployment lifecycle

`DISCOVERED → VALIDATED → BUILT → TESTED → APPROVED → RELEASED → HEALTHY → VERIFIED`

A failed stage blocks promotion. Rollback references the last known-good immutable image digest. A Git commit SHA is not a substitute for an image digest.

## Provider-neutral target model

A target adapter exposes capability and health information without leaking provider-specific details into the control plane:

- `inspectTarget()`
- `validateRelease(release)`
- `deployRelease(release, policy)`
- `getDeployment(deploymentId)`
- `getHealth(deploymentId)`
- `rollback(deploymentId, knownGoodRelease)`

Initial adapters: NODE01-SW runtime adapter first; optional external Docker-compatible target second. No adapter may claim success without runtime evidence.

## AI/operator integration

The management API is read-only by default. Mutations require a narrowly scoped service identity, an allowlisted operation, an idempotency key, policy evaluation, and an audit event. Production promotion, rollback, destructive operations, and secret rotation require explicit human approval. No arbitrary shell endpoint and no unrestricted host access.

## Current state

The repository now includes the lifecycle policy, authorization boundary, atomic transaction coordinator, and a concrete PostgreSQL adapter. The adapter reuses the existing Runtime Fabric deployment row and FORTRESS audit table on one PostgreSQL connection; it creates no tables and runs no migrations. Disposable PostgreSQL CI tests cover atomic commit/rollback, idempotent replay, conflicting requests, concurrent requests and tenant/application/environment scoping. Runtime Fabric updates also preserve the reserved DEPLOY metadata subdocument.

This is implementation code, not a production activation claim. The API is not yet wired to a production FORTRESS verifier or approved database pool. The adapter fails closed if the Runtime Fabric deployment table and FORTRESS audit table are not on the same database. Database ownership, environment/DSN binding, migration authority, grants/RLS, and database-level audit immutability still require owner verification. The policy does not execute deployments or prove that a target is connected, that a deployment has run, or that public HTTPS is live. The target adapter reports registry runtime metadata as a candidate declaration only; it never marks the binding independently verified or owner-authorized, and it never returns an executable selected target.


## Identity integration gate

The FORTRESS-to-DEPLOY token, entitlement, live-session and API enforcement requirements are specified in [IDENTITY-INTEGRATION-CONTRACT.md](./IDENTITY-INTEGRATION-CONTRACT.md). This is a design contract, not a deployed integration. Creator-audience tokens are not valid DEPLOY credentials; production API authentication remains blocked until the issuer contract and server-side verifier adapter are implemented and tested. The policy helper requires integer `iat`, `nbf`, and `exp` claims, a `jti`, a maximum ten-minute token lifetime, and a separate live-session callback bound to JTI, subject, tenant and expiry. The callbacks are interfaces only; no FORTRESS adapter or production service binding is implemented.


## Owned-host DEPLOY API

The owned-host HTTP boundary is implemented in `api.mjs`, `server.mjs` and `fortress-verifier.mjs`. It is deliberately separate from NODE01 bootstrap and FORTRESS identity. It does not create databases, run migrations, provision hosts, change DNS or deploy applications.

### HTTP contract

- `GET /healthz` — liveness only.
- `POST /api/tenants/{tenantId}/applications/{applicationId}/environments/{environmentId}/deployments/{deploymentId}/transitions` — authenticated state transition.
  - `Authorization: Bearer <FORTRESS DEPLOY capability>`
  - `Idempotency-Key: <8–256 character stable key>`
  - JSON body: `{"nextState":"VALIDATED","evidence":{...}}`

Responses are JSON, carry a request ID and use `Cache-Control: no-store`. The API has no public CORS policy and the host Compose profile publishes no host port.

The API delegates token verification to the FORTRESS internal introspection endpoint. The verifier accepts only a successful, live-session result and marks it with a process-local trust marker. A caller-supplied object cannot forge that marker. The API then enforces tenant/application/environment/scope binding and executes the transition, idempotency record and audit event in one PostgreSQL transaction.

### Required runtime configuration

- `IZAKHONO_RUNTIME_DATABASE_URL` — explicitly owner-provisioned Runtime Fabric PostgreSQL DSN.
- `FORTRESS_DEPLOY_INTROSPECTION_URL` — exact HTTPS URL ending in `/api/fortress/deploy-token/introspect`.
- `FORTRESS_DEPLOY_INTROSPECTION_SECRET` — separate 32+ byte secret; never the JWT signing secret.
- `FORTRESS_SESSION_ISSUER` and `FORTRESS_DEPLOY_AUDIENCE`.
- `DEPLOY_CONTROL_APPROVAL_DATABASE_FINGERPRINT` — SHA-256 fingerprint from the read-only Runtime Fabric preflight and included in the detached NODE01 owner approval.
- `DEPLOY_CONTROL_APPROVAL_FORTRESS_ENDPOINT` — exact introspection endpoint included in the same signed approval.

Startup is fail-closed. It requires the Runtime Fabric deployment, FORTRESS audit and migration-ledger tables; a non-owner runtime database role; deployment SELECT/INSERT/UPDATE; audit SELECT/INSERT only; migration-ledger SELECT; an enabled append-only audit trigger; an applied migration checksum matching the signed NODE01 approval; a matching signed database fingerprint; an exact FORTRESS endpoint match; and a reachable introspection endpoint with the separate internal secret. No schema is created or changed at startup.

### Database schema

Migration source: `migrations/0001_runtime_fabric_deploy.sql`.

The migration creates:
- `izakhono_runtime_deployments`, with tenant/application/environment scope generated from JSONB metadata.
- `fortress_audit_events`, tenant-bound to its deployment and protected by UPDATE/DELETE/TRUNCATE triggers plus revoked PUBLIC mutation privileges.

The migration must be reviewed and applied by the owner-approved migration runner. `migrate.mjs` is the new explicit runner: `node deploy-control/migrate.mjs --check` verifies the detached Ed25519 approval, exact migration checksum, database fingerprint and migration ledger without writes; `--apply` is the only mode that applies the SQL. It uses an advisory transaction lock and records the migration checksum, runner ID, approval ID, change reference and rollback reference in `izakhono_runtime_schema_migrations`. Reapplication with the same checksum is idempotent; a changed checksum is rejected.

The runner requires `IZAKHONO_RUNTIME_DATABASE_URL`, `IZAKHONO_RUNTIME_DATABASE_ID`, `IZAKHONO_RUNTIME_DATABASE_ENVIRONMENT`, `IZAKHONO_RUNTIME_DATABASE_OWNER`, `IZAKHONO_MIGRATION_RUNNER_ID`, `IZAKHONO_MIGRATION_APPROVAL_FILE`, `IZAKHONO_MIGRATION_APPROVAL_SIGNATURE_FILE` and `IZAKHONO_MIGRATION_OWNER_PUBLIC_KEY_FILE`. The signed approval binds the migration ID/SHA-256, database fingerprint/ID/environment/owner, migration runner, approver, approval/expiry timestamps, change reference and rollback reference. The service runtime role must not own the deployment, audit or migration-ledger tables. Grant it SELECT/INSERT/UPDATE on deployment rows, SELECT/INSERT only on the audit ledger, and SELECT on the migration ledger. The read-only preflight checks these grants, the append-only trigger and the applied migration checksum. No remote migration has been run by this change.

### NODE01 activation gate

The service is an optional `deploy-control` Compose profile on the internal `izakhono` network. NODE01 starts it only when the detached owner approval includes `activate-deploy-control-api`. That signed approval must also include:

- `runtime_database_fingerprint` (64 lowercase hexadecimal characters),
- `runtime_database_id`,
- `runtime_database_environment` (must be `production` for NODE01),
- `runtime_database_owner`,
- `runtime_migration_runner`,
- `fortress_introspection_endpoint` (exact HTTPS introspection URL).

The wrapper verifies the detached signature and passes the signed fingerprint and endpoint to the container. The container recomputes the fingerprint from the connected database identity and refuses to listen if it differs. Without the optional action, the base owned runtime remains unchanged and DEPLOY is not started.

### Local tests

- `npm install --no-save --ignore-scripts --no-audit --no-fund pg@8.16.3`
- `node --test deploy-control/lifecycle.test.mjs deploy-control/target-adapter.test.mjs deploy-control/authorization.test.mjs deploy-control/transaction.test.mjs deploy-control/postgres.integration.test.mjs`

PostgreSQL integration tests require a disposable `DEPLOY_TEST_DATABASE_URL`. They create and drop test tables in that database only.
