# IZAKHONO AI Workforce — Architecture Specification v1.0

**Status:** Proposed architecture / review baseline  
**Date:** 2026-11-23  
**Implementation status:** This document does not assert implementation, registration, deployment or production readiness.

## 1. Executive decision

IZAKHONO will absorb the useful FleetRegistry concepts into the existing IZAKHONO platform rather than create a parallel agent control plane.

The product direction is an enterprise AI Workforce: a governed, provider-neutral fleet whose identities, ownership, permissions, work, evidence, memory portability and operational health can be managed through one coherent system.

> Intelligence may be distributed. Authority, accountability and trust must never be.

This specification is additive to the existing NODE01 Agent Fabric, FORTRESS, Runtime Fabric, IZAKHONO Execution OS and identity/registry capabilities. It does not replace them.

## 2. Existing architecture and responsibility boundaries

| Component | Authoritative responsibility | Must not become |
|---|---|---|
| FORTRESS | Identity and policy decisions, scoped authorization, credential protection, approvals and audit controls | Agent scheduler or model provider |
| NODE01 Agent Fabric | Agent/task orchestration, dependency graph, bounded execution and task evidence | Identity source of truth or permission-granting authority |
| NODE01 runtime identity | Logical identity/workload target used by registered runtime interfaces | Physical server or assumed execution host |
| Runtime Fabric | Workload scheduling, runtime registration, state, health and failover | Human authorization authority |
| Authorized HOST execution adapter | Executes permitted commands against a separately registered execution environment | Capability inferred from a callback or healthy process |
| IZAKHONO Execution OS | Objective lifecycle, delivery state, acceptance and evidence coordination | Bypass around FORTRESS or Runtime Fabric |
| AI Gateway/provider adapters | Optional model inference and provider-specific integration | System of record for identity, entitlements, secrets or customer data |

The existing NODE01 Agent Fabric already defines a provider-neutral execution layer, specialist-agent manifest, bounded orchestration, registered-tool execution and evidence receipts. This programme extends those contracts; it does not duplicate the scheduler or create a second fleet runtime.

Existing references:
- products/node01-agent-fabric/README.md
- products/node01-agent-fabric/ORCHESTRATION-V1.md
- products/node01-agent-fabric/TOOL-FABRIC.md
- products/node01-agent-fabric/OBSERVE-CONTROL.md
- products/node01-agent-fabric/PERSISTENT-RUNTIME.md
- products/izakhono-fortress/README.md
- products/izakhono-execution-os/EXECUTION-CONTRACT.md
- docs/IZAKHONO_UNIFIED_EXECUTION_ARCHITECTURE.md

## 3. Product capabilities

### 3.1 Agent Registry and Identity

Every managed agent has a stable opaque agent_id and a versioned identity record.

Minimum fields:
- agent_id, tenant_id and organization_id;
- accountable owner principal and ownership relationship;
- lifecycle state and record version;
- provider, model family and adapter identifier, where applicable;
- runtime/workload binding reference, never an assumed host name;
- declared capabilities and their versions;
- policy profile reference;
- timestamps, provenance and evidence references.

Agent identity is distinct from the accountable human/organization, provider account/model, logical NODE01 workload identity and registered execution environment.

Human identity verification may use an approved provider, including Stripe Identity where appropriate. A verification result is a scoped assertion containing issuer, subject, purpose, timestamp, expiry and revocation state. It does not prove every subsequent agent action is trustworthy. Do not retain identity documents or biometric material unless separately authorized and legally justified.

### 3.2 Unified Agent Command

The command surface provides fleet search, status, policy visibility, approved task controls and operator alerts.

Every consequential command records the authenticated operator, tenant scope, target, requested operation, FORTRESS decision, idempotency key, correlation ID, execution acknowledgement/rejection and audit reference.

A stop request is not proof of stop. Report success only after enforcement acknowledgements. For IZAKHONO-managed work, the authoritative stop path must prevent new dispatch, cancel or drain active work where supported, revoke task-scoped capabilities and record residual execution that cannot be interrupted.

Provider cancellation may be best-effort. The UI must show provider-specific limitations and unresolved active work.

### 3.3 AgentSync — portable state

AgentSync is a controlled export/import and recovery service.

Portable classes:
- agent configuration and versioned instructions;
- skill definitions and manifests;
- workflow definitions and non-secret tool schemas;
- approved memory records and knowledge references;
- provenance, policy labels and compatibility metadata;
- signed backup manifests and restore evidence.

Never bundle passwords, API keys, private keys, raw tokens, provider cookies, browser sessions, OAuth refresh tokens, unclassified tenant data, hidden provider internals or proprietary model weights. Do not transfer memory prohibited by source policy, contract or consent.

Every export is tenant-scoped, encrypted, versioned and integrity-checked. Import requires content scanning, schema validation, policy re-evaluation, compatibility checks and human approval where required. Restore is staged and reversible. A backup is not valid until a restore test passes.

Memory is data with provenance and policy, not a magic transferable model state. Provider-specific hidden memory may be inaccessible and must be reported as non-portable rather than simulated.

### 3.4 Capability and competency assurance

Keep three evidence classes separate:
- **Declared:** asserted by an owner, agent manifest or provider.
- **Observed:** demonstrated by recorded execution under a known test or task.
- **Verified:** passed an authorized, versioned assessment with reproducible evidence.

Training completion can award a learning record or credential; it cannot automatically grant permissions, sensitive-data access or production authority.

Standing must not be purchasable. Measurements are explainable, time-bounded and separated by quality, reliability, safety, security, cost efficiency and policy compliance. Do not compress them into a single trust score that conceals critical failures.

### 3.5 Fleet Monitor

Aggregate authorized telemetry for runtime registration/health, queue depth, task state, failures/retries, provider availability, cost/resource consumption, policy denials, approval queues, revoked grants, instruction/skill/model drift, backup age, restore-test status and incident/recovery state.

Every metric includes source, timestamp, scope, freshness and coverage. Missing telemetry is unknown, never healthy. Cost attribution distinguishes estimates from provider-billed actuals.

### 3.6 Agent Academy

Training records include course/version, learner agent, accountable owner, assessment method, result, assessor, evidence and expiry/reassessment policy. Credentials attest only to the assessed competency and scope; they do not grant execution rights.

### 3.7 Independent assurance

Operational control and independent assurance are separate. FORTRESS makes authorization decisions. An evidence service stores append-only event records and exposes verifiable proofs to authorized auditors without granting operational command.

Use hash chaining or signed checkpoints, key rotation, retention policy, export and independent verification. A hash chain alone is not tamper-proof: protect signing keys, restrict write paths, anchor checkpoints independently and test recovery.

## 4. Target architecture and trust boundaries

Human / Organization
  -> IZAKHONO Agent Command (operator UX and fleet views)
  -> Agent Registry (identity references, lifecycle, capability claims)
  -> FORTRESS (policy decision, approval, scoped capability, audit)
  -> NODE01 Agent Fabric (plan, dependency graph, schedule, execute)
       -> AI Gateway/provider adapters (optional inference)
       -> Tool Fabric (registered tools only)
  -> Runtime Fabric (registered workload scheduling and state)
  -> Authorized HOST execution adapter
  -> Separately registered execution environment

AgentSync performs policy-gated export/import of approved agent state. The evidence service receives correlated events and receipts from all control points.

This is a target responsibility map, not evidence that every interface currently exists.

Trust-boundary rules:
1. FORTRESS is the policy authority. Agents, models and schedulers cannot grant themselves permissions.
2. The scheduler selects only registered agents, tools and workloads within policy-approved scopes.
3. Model output is untrusted input. It cannot invoke arbitrary code, alter policy or bypass Tool Fabric.
4. Provider adapters are explicit, least-privilege integrations. External providers are not IZAKHONO systems of record.
5. Runtime health is not authorization. A healthy process does not prove gateway registration or execution permission.
6. NODE01 is a logical runtime identity. Actual execution requires a verified authorized adapter and separately registered healthy execution environment.
7. Unknown, stale, malformed or contradictory registration, policy or evidence fails closed for consequential operations.
8. Tenant isolation applies to identity, memory, tasks, evidence, telemetry, backups, search and restore.

## 5. Authorization and emergency control

Every consequential operation is authorized at the enforcement point, not merely hidden or disabled in the UI.

A grant is bound to tenant/organization, principal, target agent/tool/environment, action/resource scope, purpose/data classification, expiry/revocation, policy version, decision ID, correlation ID and idempotency identifier.

Use short-lived, audience-bound capabilities. Prefer narrowly scoped grants over broad reusable credentials. Credentials remain in FORTRESS-controlled secret handling and are injected at execution time; they never appear in prompts, portable backups, ordinary task payloads or receipts.

Emergency control states:
- **STOP:** block new work and request cancellation of active work.
- **ISOLATE:** deny network/tool/agent interactions except approved recovery channels.
- **REVOKE:** invalidate grants and task-scoped capabilities.
- **PRESERVE:** retain investigation evidence subject to retention and privacy policy.
- **RECOVER:** require fresh health, identity, policy and operator approval before resuming.

Emergency controls must be independently auditable and tested. A UI action is not complete until enforcement acknowledgements arrive. If a provider cannot guarantee cancellation, show the limitation and keep the agent/workload restricted.

No agent may approve its own access, modify its governing policy, issue or extend its credentials, disable or erase audit, promote declared capability to verified, remove human approval or silently transfer tenant data.

## 6. Canonical lifecycle and event model

Suggested agent lifecycle:
PROPOSED -> REGISTERED -> VALIDATING -> ACTIVE -> PAUSED -> ISOLATED -> REVOKED -> RETIRED

Transitions require an actor, policy decision and evidence. ACTIVE requires valid identity, current policy, permitted adapter and healthy registered runtime where execution is expected. PAUSED is not REVOKED. RETIRED is terminal for normal operations but preserves governed audit records.

Suggested task lifecycle:
REQUESTED -> AUTHORIZING -> QUEUED -> RUNNING -> VERIFYING -> SUCCEEDED

Explicit terminal/recovery states: DENIED, CANCELLED, FAILED, TIMED_OUT, QUARANTINED and REQUIRES_HUMAN.

Core event envelope:
- event ID, schema version, event type and event time;
- tenant, organization, agent, task and workload references;
- actor/principal and source component;
- correlation ID, causation ID and idempotency key;
- policy decision and approval references;
- payload classification and redaction metadata;
- evidence digest and signature/checkpoint reference.

Events are append-only from the application perspective. Corrections are compensating events, not silent mutation of history.

## 7. Initial logical data model

This is a logical model only, not a database migration or authority to modify a production database.

| Record | Purpose | Key constraints |
|---|---|---|
| Agent | Stable identity and lifecycle | Unique per tenant; immutable identity |
| AgentVersion | Versioned configuration and manifest | Content digest; provenance |
| OwnershipBinding | Human/org accountability | Verified issuer and revocation state |
| ProviderBinding | Model/provider adapter reference | No provider credential material |
| RuntimeBinding | Registered workload/environment reference | Verified registration and health evidence |
| CapabilityClaim | Declared/observed/verified capability | Evidence class and assessor required |
| PolicyBinding | Applicable FORTRESS policy reference | Policy version and scope |
| Task / TaskAttempt | Requested and executed work | Idempotency, bounded retries |
| Approval | Human decision for gated action | Actor, scope, expiry and decision evidence |
| AgentStateSnapshot | Approved portable state | Classification, encryption and content digest |
| BackupManifest | Backup contents and integrity | Signed manifest; restore-test status |
| TrainingRecord | Course and assessment evidence | Versioned course and assessor |
| TelemetryObservation | Health, cost and performance signal | Source and freshness |
| AuditEvent | Accountability event | Append-only, correlated, tenant-scoped |
| EvidenceCheckpoint | Independently verifiable checkpoint | Signed digest and key version |

Database ownership, migration authority, transaction semantics, RLS and persistence choice must be confirmed against the existing owned-runtime architecture before implementation. No schema is applied to a live database from this specification.

## 8. Adapter contracts

All provider, identity, runtime and tool integrations implement explicit versioned contracts.

Minimum adapter metadata: adapter ID/version/owner/protocol; capabilities and unsupported operations; accepted data classes and retention behavior; authentication method and secret reference; timeout/retry/idempotency/cancellation semantics; rate limits and cost reporting; health and registration probes; authorization enforcement point; evidence and verification method; rollback, disable and credential-revocation procedure.

Provider-neutral does not mean behavior-identical. The capability matrix must describe differences between ChatGPT, Claude, Grok and other integrations. Never claim universal stop, memory export, identity proof or telemetry when an adapter cannot supply it.

## 9. Non-functional and security requirements

- **Fail closed:** deny consequential actions when policy, identity, registration or audit acknowledgement is unavailable.
- **Tenant isolation:** enforce at API, data, cache, queue, search, telemetry and backup layers.
- **Least privilege:** default-deny; short-lived scoped grants; explicit revocation.
- **Privacy:** collect only necessary data; classify, redact and apply retention limits.
- **Integrity:** versioned records, content digests, signed manifests and independently anchored evidence checkpoints.
- **Resilience:** bounded retries, idempotency, durable receipts, tested backup/restore and documented recovery.
- **Observability:** source and freshness on every signal; unknown is not healthy.
- **Portability:** documented formats, compatibility checks, export and restore tests.
- **Usability:** coherent command surface with clear approval, failure and recovery states.
- **Cost transparency:** estimate versus actual, per-tenant and per-task attribution.
- **Provider independence:** no external model provider is required for identity, authorization, secrets, core task state or audit.

## 10. Phased delivery and acceptance gates

### Phase 0 — Architecture reconciliation
Map the existing NODE01 manifest, registry, Tool Fabric, event ledger and durable queue contracts. Map FORTRESS policy/identity APIs and Runtime Fabric registration/execution interfaces. Identify overlapping products and assign one canonical owner per responsibility.

**Exit:** reviewed component map, interface inventory, threat model and explicit list of unavailable interfaces.

### Phase 1 — Registry contract and governance
Define schemas and API contracts for agent identity, ownership, lifecycle, provider binding, runtime binding and capability evidence. Define FORTRESS authorization contract, event envelope, audit semantics and emergency state machine. Add deterministic contract and negative tests.

**Exit:** schema and contract tests pass; cross-tenant access, self-approval, stale grants and unknown adapters fail closed.

### Phase 2 — Operator command and fleet visibility
Start with read-only fleet inventory and status. Add approved pause/drain/stop/isolate/revoke commands only when real enforcement adapters are registered. Show provider cancellation limitations and telemetry coverage.

**Exit:** operator actions are correlated, policy-authorized and evidenced; UI never reports unacknowledged actions as complete.

### Phase 3 — AgentSync portability
Define export format, classification and encryption. Implement scanning, compatibility validation, staged restore and rollback. Exclude credentials and provider sessions. Add supported cross-version/provider restore tests.

**Exit:** restore, tenant-isolation and secret-scanning tests pass.

### Phase 4 — Capability, training and fleet intelligence
Record declared, observed and verified capability separately. Add versioned assessments and competency records. Add cost, reliability, health, drift and compliance views.

**Exit:** every score is explainable and traceable to evidence; unknown coverage remains visible.

### Phase 5 — External provider expansion
Add ChatGPT, Claude, Grok and other adapters only as capabilities are verified. Publish a provider capability matrix. Test rate limits, cancellation, data handling, identity mapping and failure behavior.

**Exit:** no provider capability is advertised beyond tested adapter evidence.

## 11. Mandatory acceptance tests

1. Agent IDs are stable and unique within tenant scope.
2. A tenant cannot enumerate or retrieve another tenant's agents, tasks, memory, evidence or backups.
3. An agent cannot approve itself, elevate permissions or modify policy.
4. Expired, revoked, wrong-audience and wrong-scope grants are rejected at execution.
5. Unknown or stale runtime registration prevents consequential execution.
6. A healthy NODE01 process without a registered execution environment does not pass the execution gate.
7. Stop prevents new dispatch and reports active-task cancellation outcomes truthfully.
8. Provider cancellation failure leaves the task visibly unresolved/restricted.
9. Every consequential task has a correlated policy decision and durable evidence receipt.
10. Duplicate idempotency keys with different request fingerprints are rejected.
11. Audit history cannot be silently overwritten; corrections create linked events.
12. Backup packages contain no credentials, session tokens or prohibited data.
13. Restore rejects tampered, incompatible, unscanned or unauthorized packages.
14. A successful backup without a successful restore test is not labelled recoverable.
15. Declared capability cannot be displayed as independently verified.
16. Training completion cannot grant runtime permissions.
17. Missing telemetry displays unknown/stale, not healthy.
18. External provider egress is checked against tenant policy.
19. Every adapter has negative tests for timeout, retry, cancellation and authorization failure.
20. Architecture validation causes no production database, DNS, runtime or deployment changes.

## 12. Explicit non-goals and release truth

This specification does not implement or deploy the AI Workforce, create a database, change database ownership, apply migrations, register a physical host, infer a host from NODE01, enable a disabled runner, invent an execution gateway, change DNS or production routing, assert universal provider control, claim all provider memory is portable, or assert certification/compliance/audit completion.

Use precise states:
- **PROPOSED:** described in this architecture only.
- **IMPLEMENTED:** code exists and review identifies exact scope.
- **VALIDATED:** stated tests passed in a named environment.
- **REGISTERED:** real adapter/runtime registration is confirmed.
- **AUTHORIZED:** current FORTRESS decision permits the exact action.
- **DEPLOYED:** deployment evidence identifies target and artifact.
- **PRODUCTION VERIFIED:** live acceptance evidence and monitoring prove required behavior.

A state is never inferred from a prior state.

## 13. Immediate next engineering action

Complete Phase 0 reconciliation against the current main branch and active IZAKHONO MAIL Runtime Fabric integration work. Produce a component/interface matrix and identify canonical owners for agent identity/ownership, policy/authorization, orchestration/task execution, runtime registration/execution, durable state/audit, portability/backup and fleet telemetry/assurance.

Keep this proposal isolated for review. Do not merge it into the active MAIL integration branch or alter its release state. No production deployment, DNS change, database migration or runtime activation is authorized by this document.
