# IZAKHONO AI Workforce — Phase 1 Contract Hardening Review

**Status:** Proposed engineering review; owner decisions required  
**Reviewed:** 2026-11-24  
**Scope:** Read-only reconciliation of the proposed v1 contracts against source interfaces on `main`. This document proposes contract corrections and acceptance criteria only. It does not implement an API, change a database, authorize migrations, register a runtime, or activate execution.

## 1. Review basis and release truth

Reviewed source areas:

- `products/izakhono-fortress/guard.py` and `policy.json`
- `products/fortress-identity/src/worker.ts`
- `products/node01-agent-fabric/src/node01/tool_fabric.py`, `policy.py`, `persistent_queue.py`, and `registry.py`
- `infra/runtime-fabric/controller/runtime_fabric_controller.py`, `workload_activation.py`, `activation_transaction.py`, `deployment_state.py`, `postgres_deployment_store.py`, `postgres_event_store.py`, `runtime_store_factory.py`, and `observability.py`

This is source-level inspection, not a deployment probe, live authorization test, database ownership confirmation, security assessment, or production acceptance test. The presence of code does not prove that it is deployed, configured, reachable, owned for this workload, or authorized for production use.

## 2. Corrected source-to-contract findings

| Boundary | Existing source behaviour | Contract consequence |
|---|---|---|
| FORTRESS egress policy | `POST /v1/authorize-egress` authenticates with a configured bearer token and evaluates entity scope, provider class, purpose and data class. It returns an allow/deny boolean and reason. | This is an external-egress policy check, not an agent-task authorization decision. Do not rename or silently stretch it into the proposed `/v1/authorize` contract. |
| FORTRESS human identity | `GET /api/fortress/session` introspects a short-lived signed session and returns a human principal, tenant and role after session/revocation checks. The configured issuer/audience defaults are for the creator session audience. | Reuse only after the consuming service's issuer, audience, signature-key handling, revocation and tenant-claim validation are confirmed. This is not an agent workload credential, approval service, independent identity-verification result or task grant. |
| NODE01 local policy | `Policy.evaluate` makes local risk decisions; external side effects may require approval. | Retain as a local secondary deny/control layer. It cannot issue FORTRESS authority or approve a task. |
| NODE01 Tool Fabric | `ToolRequest.approval_granted` is caller-supplied; when local policy says approval is required, a true value permits the handler to run. | This field must not be accepted as production authorization proof. Before consequential handlers execute, require an independently verified, actor/tenant/action/resource/audience-bound FORTRESS decision and any bound human approval. |
| NODE01 queue | SQLite queue has local task/receipt tables, leases, retry handling and a globally unique idempotency key within that database. It does not bind the key to a tenant or request fingerprint. | Reuse queue semantics only. Define tenant-scoped idempotency and same-key/different-request conflict behaviour in the production contract. |
| NODE01 catalogue | `registry.py` defines specialist `AgentSpec` records and a process-local lookup map. | This is a capability catalogue, not a durable agent identity/ownership/lifecycle registry. Keep the catalogue in NODE01; assign canonical agent identity ownership separately. |
| Runtime Fabric selection | Controller selects a logical node from externally supplied boolean health values. `NODE01` is a software identity; execution host/environment is separate. | Health/selection is not registration, identity attestation, tenant binding, authorization or proof of HOST execution. |
| Runtime Fabric activation | Activation transaction invokes supplied callbacks returning booleans. The generic bridge does not itself authenticate a HOST runner, verify a FORTRESS decision or validate a signed execution receipt. | Treat callbacks as orchestration seams, not a verified execution adapter. Require a concrete, separately registered and authenticated adapter contract before consequential work. |
| Runtime Fabric PostgreSQL state | PostgreSQL deployment store code exists, with deployment rows and atomic recovery leases. Its current record/store shape is deployment-oriented and has no AI Workforce tenant/agent/actor/policy binding. The factory's initialization path executes table-creation SQL. | Correct the gap statement: PostgreSQL deployment persistence code exists. It is not evidence of an approved AI Workforce persistence owner, tenant-scoped registry, authorized migration, or deployed production integration. Do not run initialization or migrations as part of this review. |
| Runtime Fabric events | PostgreSQL event store appends events in its own database operation/commit. Its current event fields are deployment-centric; it does not provide the proposed workforce event envelope or an atomic outbox transaction with deployment state. | Do not call the existing store a complete authoritative workforce evidence service. Define a shared transaction/outbox boundary and evidence ownership before consequential actions are enabled. |
| Runtime Fabric state | Deployment state model and memory store support state transitions; PostgreSQL implementation supports durable records and leases. | This is a useful existing subsystem to reconcile with, not a reason to create another scheduler or to assume agent/task state is solved. |

## 3. Required contract corrections before implementation

### 3.1 Identity and ownership

1. Keep the existing NODE01 specialist catalogue as capability metadata.
2. Create no second Commander device registry and no duplicate FORTRESS human-principal store.
3. Assign one accountable owner for the canonical Agent Registry service and persistence boundary before choosing tables or migrations.
4. Define immutable opaque `agent_id`, tenant-scoped uniqueness, immutable creation provenance, owner-principal binding, lifecycle version and versioned configuration.
5. Require authenticated actor claims to be validated server-side. A tenant header/body field is only a consistency assertion, never authority.
6. Define owner transfer, tenant transfer, deletion/retirement, legal hold, and orphaned-owner handling as explicit audited transitions. No silent cross-tenant transfer.

### 3.2 FORTRESS decision and approval

The proposed agent-task authorization operation is a new contract requiring FORTRESS owner acceptance; it is not an existing endpoint.

A decision must bind at minimum:

- authenticated actor identity, issuer, authentication context and actor type;
- tenant and organization;
- subject agent and immutable agent version;
- task/attempt and request fingerprint;
- action, resource, tool, environment, purpose and data classification;
- exact execution audience and permitted constraints;
- policy ID/version, decision ID, issue/not-before/expiry times;
- approval reference and approval fingerprint where required;
- revocation/check status and durable audit reference.

Enforcement requirements:

- Verify online with FORTRESS or verify a signed, short-lived, audience-bound artifact using an explicitly approved key-distribution and rotation protocol.
- Reject missing, malformed, expired, not-yet-valid, revoked, stale-policy, wrong-tenant, wrong-actor, wrong-agent, wrong-action, wrong-resource, wrong-audience or mismatched-fingerprint decisions.
- A decision reference is not a bearer credential. Never accept a caller-supplied `approved` or `approval_granted` boolean as authority.
- Human approval is a separate lifecycle object, bound to a request fingerprint, named human principal, tenant, scope, policy version and expiry. Delegation must be explicit and independently authorized.
- Local NODE01 risk policy may further deny; it cannot override a FORTRESS denial or manufacture an allow.
- Fail closed when FORTRESS cannot be reached unless a separately approved, narrowly scoped offline-verification mode exists with defined expiry, revocation limitations and risk boundaries.

### 3.3 Runtime registration and HOST execution

Keep three distinct identities:

1. logical runtime identity (for example, NODE01);
2. registered workload/runtime binding;
3. actual execution environment and authenticated HOST runner.

Before execution, the adapter must validate:

- signed/verified adapter identity and version;
- separately registered execution environment identity;
- tenant and workload binding;
- current registration and health TTL;
- FORTRESS decision/approval for the exact request and execution audience;
- allowlisted command/tool, arguments and data classification;
- timeout, resource, output-redaction and network constraints.

The HOST execution receipt must be authenticated and bind the request fingerprint, decision reference, tenant, workload, environment, adapter version, command/tool identity, start/end timestamps, outcome, output digest and cancellation result. A NODE01 orchestration receipt may attest what NODE01 observed; it must not impersonate HOST execution evidence.

Cancellation must distinguish requested, accepted, acknowledged, completed and unsupported. If an external provider cannot guarantee cancellation, retain an unresolved/restricted state and report the residual-work risk.

### 3.4 Persistence, idempotency and evidence

The source review found existing PostgreSQL deployment-state and event-store implementations, but not a complete atomic workforce persistence contract.

Before implementation, the persistence owner must decide:

- canonical database/service owner, environment and tenant isolation model;
- who may create/alter schemas and run migrations;
- transaction isolation and concurrency/lease semantics;
- transactional outbox/inbox or equivalent atomic state-plus-event pattern;
- idempotency scope, retention and request-fingerprint conflict behaviour;
- event ordering guarantees, deduplication, replay and poison-message handling;
- evidence retention, legal hold, backup, restore, independent checkpoint and auditor read access.

Required invariants:

- A consequential state transition and its required audit/outbox record commit atomically, or the operation remains explicitly pending/unknown and cannot be reported complete.
- Consumers are idempotent; duplicate event delivery does not duplicate a consequential action.
- Same idempotency key plus same canonical request fingerprint returns the original operation/result; same key plus a different fingerprint is rejected.
- Idempotency scope includes tenant, authenticated actor/client and operation family; keys cannot collide across tenants to reveal resource existence.
- Append-only application semantics are backed by database permissions, retention controls, independent checkpoints and tested restore. A hash chain or append-only API alone is not proof of tamper resistance.
- Event payloads are classified and redacted; secrets and raw credentials never enter task receipts or audit payloads.

### 3.5 Lifecycle and emergency control

Separate desired state from observed enforcement state. A requested PAUSE/STOP/ISOLATE/REVOKE is not complete until each required enforcement point acknowledges it. Model partial, unknown, timed-out and unreachable executors explicitly. Revocation must prevent new dispatch immediately at the authoritative gate; active work is tracked until cancellation is acknowledged or residual risk is recorded. Recovery requires fresh registration, health, policy and operator authorization.

## 4. Owner decision register

No owner confirmations are inferred from repository code, PR authorship, CI, or documentation.

| Decision | Accountable owner to confirm | Evidence required | Gate |
|---|---|---|---|
| Canonical Agent Registry ownership and tenant namespace | IZAKHONO architecture/product owner; named service owner | Written decision covering identity namespace, lifecycle writes, ownership transfer and service boundary | Blocks registry schema and implementation |
| Agent Registry persistence and migration authority | Database/platform owner | Named database, environment, approved migration operator, backup/restore and rollback authority | Blocks persistence changes |
| FORTRESS task-authorization contract | FORTRESS security/policy owner | Accepted request/decision schema, issuer/audience, signature or online verification, revocation, outage and policy-version semantics | Blocks consequential tool execution |
| Human approval and delegation | FORTRESS governance owner | Approval service owner, approver eligibility, delegation policy, fingerprint binding, expiry/revocation and audit evidence | Blocks approval-gated execution |
| Human principal/session integration | FORTRESS Identity owner | Deployed issuer/audience/key validation, service authentication, tenant mapping and revocation test evidence | Blocks trusted actor attribution |
| Runtime registration | Runtime Fabric owner | API/schema, registration proof, health TTL, workload isolation, stale/revoked behaviour and acknowledgements | Blocks runtime-bound dispatch |
| HOST execution adapter | HOST/platform execution owner | Actual runner identity, environment registration, command allowlist, authentication, signed receipt, timeout and cancellation tests | Blocks all real external execution |
| Workforce persistence/atomic evidence | Database/platform and evidence-service owners | Approved state/event/outbox transaction boundary, idempotency and recovery design | Blocks consequential state changes |
| Provider capability truth | Each provider-adapter owner | Versioned tested matrix for tool execution, stop/cancel, memory export, telemetry, data handling and retention | Blocks provider capability claims |
| Tenant isolation and independent assurance | Security/privacy and assurance owners | Negative tests across API, DB, cache, queue, search, telemetry, backups, restore and auditor access | Blocks tenant production use |

## 5. Minimum contract acceptance suite

The following tests are required before any Phase 1 implementation can be accepted. They are proposed test requirements, not tests executed by this review.

1. A tenant cannot list, fetch, mutate, search, export or infer another tenant's agent/task/evidence/backup.
2. A body/header tenant mismatch against the authenticated principal is rejected.
3. An agent cannot approve itself, alter policy, issue credentials or promote its own capability evidence.
4. A caller-supplied `approval_granted=true` without a valid FORTRESS decision is rejected at the tool execution boundary.
5. A FORTRESS denial cannot be overridden by local NODE01 policy or an operator UI.
6. Wrong issuer, audience, tenant, actor, agent, action, resource, request fingerprint or execution environment is rejected.
7. Expired, not-yet-valid, revoked, stale-policy and key-rotation-invalid artifacts are rejected.
8. Human approval cannot be replayed against a different request fingerprint or after expiry/revocation.
9. FORTRESS outage fails closed for consequential actions and emits a non-sensitive, correlated failure record.
10. Unknown, stale, unverified or revoked RuntimeBinding prevents consequential dispatch.
11. Healthy logical NODE01 without separately registered HOST environment does not pass the execution gate.
12. A callback returning true without an authenticated HOST receipt does not produce an execution-success state.
13. A HOST receipt with mismatched request digest, environment, tenant or decision reference is rejected.
14. Stop/isolate/revoke report per-enforcement-point acknowledgement and never overstate provider cancellation.
15. Duplicate idempotency key with same fingerprint is safe; same key with different fingerprint is rejected.
16. A crash between state mutation and event publication is recovered through the approved atomic outbox/inbox boundary without lost or duplicate consequential transitions.
17. Unauthorized schema/migration attempts fail; no service can self-authorize production schema changes.
18. Audit correction is represented by a linked compensating event; historical records cannot be silently rewritten by the application role.
19. Backup restore, tenant separation, secret scanning and independent checkpoint verification are tested.
20. Missing or stale telemetry is UNKNOWN/STALE, never HEALTHY; estimates are not reported as billed cost.

## 6. Phase 1 disposition

**Contract design can proceed. Production implementation remains gated.**

Permitted next work:
- obtain named owner decisions in Section 4;
- revise the proposed v1 contract document to reflect accepted decisions;
- write pure schema/contract fixtures and negative test vectors without connecting to production services or databases;
- map the existing Runtime Fabric PostgreSQL deployment store to the future workforce persistence boundary without initializing or migrating it.

Blocked until explicit owner approval and evidence:
- creating Agent Registry tables or migrations;
- initializing or changing production PostgreSQL stores;
- changing FORTRESS identity or policy behaviour;
- replacing Tool Fabric authorization in a live runtime;
- registering or activating a HOST adapter;
- issuing production agent credentials or grants;
- enabling consequential agent execution or claiming production readiness.

**Decision:** retain one NODE01 orchestrator, one FORTRESS policy authority, one Runtime Fabric workload/state owner, one verified HOST execution boundary, and one IZAKHONO Execution OS delivery/acceptance owner. The Agent Registry is a bounded identity domain whose accountable service and persistence owner must be named; it is not a second scheduler or policy engine.
