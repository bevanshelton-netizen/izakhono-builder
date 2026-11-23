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


## 14. Phase 0 — preliminary source reconciliation (2026-11-23)

This is a read-only source inspection of the repository main branch. It is not a runtime test, security certification or production integration check.

| Existing source | Observed implementation | Architectural consequence |
|---|---|---|
| NODE01 registry.py and agent-manifest.v1.json | 24 specialist roles are stated in the package README; the registry is a process-local Python list/dictionary. The role count should be reconciled against the manifest during code-level implementation review | Reuse the capability catalogue, but do not treat it as a durable, tenant-scoped identity registry |
| NODE01 workforce.py | SubagentFactory appends new agents to process-global collections | Dynamic creation is currently process-local; persistent ownership, tenant scope, lifecycle and versioning remain unspecified in this implementation |
| NODE01 models.py | AgentSpec contains id/name/domain/capabilities/concurrency/risks; no tenant, owner, provider binding, runtime binding or lifecycle fields | Extend via versioned contracts; do not overload capability records with identity or authorization |
| NODE01 policy.py and tool_fabric.py | Local risk-based policy; external actions can return approval_required; ToolRequest carries an approval_granted boolean | Useful deterministic baseline, but not proof of FORTRESS-issued, actor-bound, scoped approval. A caller-supplied boolean must not be the production authorization artifact |
| NODE01 persistent_queue.py | SQLiteTaskQueue with durable local tables, leases, idempotency key and receipts; documented as replaceable adapter | Reuse queue semantics as a reference. It does not establish multi-host owned-runtime persistence or database ownership |
| NODE01 control_plane.py | Default InMemoryQueue, DeterministicGateway, InMemoryObserver, DraftMail and ProvisionerPlan | Safe local/reference adapters, not live provider, mail, provisioning or production queue integrations |
| NODE01 observe.py and control.py | In-memory event ledger with a maximum length that deletes oldest events; pause/resume/drain methods mutate local flags and append local events | Not a durable immutable audit ledger or verified cross-runtime emergency enforcement |
| FORTRESS policy.json and guard.py | Default-deny external egress decision with entity scope and data-class filtering; localhost policy endpoint; README says it is a policy decision point, not a transparent network firewall | Strong policy baseline to extend. Agent task authorization, approval issuance, runtime enforcement and correlated audit acknowledgement are not proven by this egress guard alone |
| FORTRESS Identity & Session Issuer | D1-backed principal/session design with token revocation and audit; documented as a source change, not a deployment | Potential human/session identity integration. It is not, by itself, an agent identity registry or third-party human ID-verification result |
| IZAKHONO Commander schema | Device enrollment/pairing and device audit tables | Device registry is not the canonical agent registry; reuse only where device identity is relevant |
| IZAKHONO Identity V1 | Private IZAKHONO namespace identity and mailbox binding | Distinct from workforce agent identity and external human identity verification |
| IZAKHONO Control NODE Fabric | Logical node roles, node pool and health-based selection | Preserve logical NODE identity. Health and role selection do not establish authorized execution adapter registration |
| IZAKHONO MAIL Runtime Fabric PR #744 | PR documentation reports missing verified gateway adapter, separate execution environment, tenant-scoped MAIL grant and correlated FORTRESS audit acknowledgement | The same real-registration and authorization gate must apply to AI Workforce execution; do not infer readiness from generic callbacks or CI |

### Phase 0 gap register

**G0 — Canonical identity ownership:** Existing capability registry is process-local; Commander devices and private namespace identities serve different purposes. Decide the canonical owner and storage boundary for agent identity, tenant ownership and lifecycle before schema work.

**G1 — FORTRESS task authorization contract:** Define an actor-bound decision/approval contract for agent and tool actions. Replace caller-asserted approval booleans at production enforcement points with verifiable, scoped FORTRESS decisions.

**G2 — Durable evidence:** NODE01's bounded in-memory event ledger is unsuitable as the authoritative audit record. Define a durable append-only event/receipt contract, transaction boundary, retention and independent checkpoint strategy. Do not assume the existing local ledger is immutable.

**G3 — Runtime registration and execution:** Require the real registered gateway adapter, separately registered healthy execution environment, tenant/workload-scoped authorization and correlated audit acknowledgement. These remain external interface gates, not documentation-only features.

**G4 — Persistence authority:** SQLite provides local queue durability, while the production persistence owner, transaction semantics and migration authority still require explicit confirmation. Do not create or migrate a production database as part of Phase 0.

**G5 — Provider capability truth:** Build a per-provider matrix for cancellation, tool execution, memory export, telemetry, identity mapping, data retention and rate limits. Do not promise universal cross-provider stop or memory portability.

**G6 — Identity verification:** Separate authenticated IZAKHONO principals from independently verified human identity assertions. Any external verification integration requires purpose limitation, issuer validation, expiry/revocation and minimal retention.

### Phase 0 disposition

The source inspection supports an additive architecture, not a new scheduler or a new competing device registry. NODE01 Agent Fabric remains the orchestration and capability-execution layer; FORTRESS remains the authorization authority; Runtime Fabric remains the workload scheduler/state manager; the verified HOST adapter remains the execution mechanism.

No production database, migration, credential, runtime, deployment, DNS or external provider action was performed. No tests were run as part of this documentation-only reconciliation.


## 15. Phase 0 — canonical ownership and interface matrix

The matrix distinguishes a documented/code-level responsibility from a production-ready integration. "Exists" below means the referenced source describes or implements a local/reference capability; it does not imply deployment or registration.

| Domain | Canonical owner (target) | Existing source/interface evidence | Missing contract or proof | Decision |
|---|---|---|---|---|
| Human principal/session | FORTRESS Identity & Session Issuer | D1-backed principal/session design, revocation and audit are documented in the identity issuer source | Confirm deployed issuer, authenticated service-to-service claims, tenant/entity mapping and external human-verification issuer validation | Reuse FORTRESS principal identity; do not create a competing human identity store |
| Agent identity and lifecycle | Agent Registry service (new bounded domain, owner to be assigned under FORTRESS governance) | NODE01 capability catalogue and process-local registry; Commander schema is device-focused | Durable agent_id, tenant/owner binding, lifecycle/version contract, uniqueness and audit semantics | New agent registry domain; not a new scheduler and not the Commander device registry |
| Agent capability catalogue | NODE01 Agent Fabric | AgentSpec, specialist manifest, registry and workforce factory | Versioned capability schema, provenance, declared/observed/verified evidence classes | Extend NODE01 catalogue; separate capability claims from identity and authorization |
| Objective/task orchestration | NODE01 Agent Fabric | Planner, task graph, bounded orchestration, registered ToolFabric and execution receipts | Authenticated operator entrypoint, durable orchestration state, production-grade replay/recovery | Keep one orchestrator: NODE01 |
| Tool execution | NODE01 Tool Fabric | Explicit tool registration, risk matching, fail-closed local policy and evidence hash | FORTRESS-issued scoped authorization at enforcement point; registered production adapters; cancellation/timeout semantics | Keep tool allowlisting in NODE01; authorization decisions belong to FORTRESS |
| Policy and approvals | FORTRESS | Default-deny external egress PDP with entity and data-class checks; token-protected localhost API | Agent/task/tool action decision schema, actor-bound approval artifact, expiry/revocation, decision verification, correlated audit acknowledgement | FORTRESS is sole policy authority; NODE01 must not trust a boolean as proof of approval |
| Runtime/workload scheduling | Runtime Fabric | Architecture and MAIL integration documentation define scheduling, runtime registration, health/state and failover responsibility | Live interface schema, registration evidence, state transition contract, health freshness and authorization handshake | Runtime Fabric remains scheduler/state owner; no parallel fleet scheduler |
| Execution environment | Authorized HOST execution adapter | MAIL PR #744 documentation identifies this as a separate real execution boundary and a current gate | Verified runner identity, command contract, environment registration, scoped credentials, execution receipt and revocation | No execution until actual authorized adapter and target registration are proven |
| Logical workload identity | NODE01 runtime identity | Existing architecture defines NODE01 as logical identity/workload target | Explicit binding from agent/task to registered workload and environment | NODE01 is not a physical host and does not prove host access |
| Queue/task durability | Runtime Fabric persistence adapter, with NODE01 queue interface | NODE01 SQLiteTaskQueue reference adapter provides task rows, leases, retry/dead-letter and idempotency semantics | Owner confirmation, multi-host concurrency, atomic task+audit commit, transaction/idempotency scope, backup/restore and migration authority | Reuse adapter semantics; select production store only after owner confirmation |
| Evidence and audit | FORTRESS-governed durable evidence service (implementation owner to be confirmed) | NODE01 receipts and in-memory observation ledger; FORTRESS identity issuer audit; Execution OS evidence references | Unified event envelope, append-only durable write path, atomicity/transaction boundary, retention, signing/checkpoint keys and independent verification | Separate operational event stream from authoritative audit/evidence record |
| Portable state and backup | AgentSync service (new bounded domain) under FORTRESS data policy | No reviewed source establishes a cross-provider portable state contract | Export schema, data classification, secret exclusion, encryption, scanning, provenance, staged restore and restore-test evidence | New portability service; must not claim provider hidden-memory export |
| Provider/model integration | IZAKHONO AI Gateway and explicit provider adapters | NODE01 orchestration docs identify DeterministicModel as offline reference and production adapters as future explicit registrations | Per-provider capability matrix, data egress policy, credentials, tool semantics, rate limits, cancellation, memory and retention | Provider is replaceable inference only, never core identity, authorization, secrets or state authority |
| Fleet telemetry | Runtime Fabric + NODE01 observation; FORTRESS security events | NODE01 reference observer and control events; runtime health responsibilities documented | Durable telemetry contract, source/freshness/coverage, tenant scoping, cost actuals and alert delivery | Aggregate signals; preserve source ownership; unknown is not healthy |
| Training/competency | Agent Academy (new product capability) with NODE01 evidence | No reviewed source establishes assessed agent credentials or competency lifecycle | Versioned courses, assessor, evidence, expiry and verification; strict separation from authorization | Training records attest learning only and never grant access |
| Delivery acceptance | IZAKHONO Execution OS | Explicit project lifecycle, blockers, evidence and completion criteria | Mapping from agent/task receipts into objective-stage evidence | Execution OS owns outcome acceptance, not agent scheduling |

### Interface contract inventory

The following interfaces are required before the corresponding capability can be marked implemented or production-ready:

| Contract | Required minimum | Current disposition |
|---|---|---|
| Agent Registry API | create/read/list/update lifecycle; tenant-scoped authorization; immutable identity; version/ETag; audit event | Proposed; not found in reviewed sources |
| FORTRESS decision API | principal, tenant/entity, target, action, resource, purpose, data class, expiry, decision ID, policy version, reason and signed/verifiable result | Egress PDP exists; agent-task decision contract not established |
| Approval API | request, approve/deny, actor, scope, expiry, one-time/replay semantics, revocation and evidence | Not established by reviewed ToolFabric boolean field |
| Runtime registration API | workload identity, adapter identity, environment identity, health/freshness, capability set, registration lease and revocation | Required by architecture; live registration not verified |
| HOST execution API | authenticated command envelope, allowlisted operation, scoped grant, timeout, idempotency, output redaction, cancellation and receipt | Execution gate remains unverified |
| Task persistence API | durable submit/lease/heartbeat/complete/fail/dead-letter; transaction and idempotency semantics | Local SQLite reference adapter exists; production owner unconfirmed |
| Evidence append API | append-only event, correlation/causation, policy decision, actor, payload classification, durable acknowledgement and checkpoint | NODE01 local receipts/events exist; authoritative durable service not established |
| AgentSync package API | signed manifest, versioned schema, encrypted payload, provenance, classification, scan result and restore transaction | Proposed; no implementation evidence reviewed |
| Provider adapter API | capability declaration, credential reference, egress policy, timeout/retry/rate limit, cancellation and provider receipt | Deterministic reference provider exists; production adapters not verified |

### Canonical ownership decisions

1. **One scheduler:** NODE01 Agent Fabric owns agent/task planning and orchestration. Runtime Fabric schedules and manages registered workloads; it does not become a second agent planner.
2. **One policy authority:** FORTRESS owns authorization, approvals, credential protection and policy versioning. Local NODE01 risk checks are defense-in-depth, not a substitute for FORTRESS.
3. **One agent identity domain:** establish an Agent Registry domain for agent identity and ownership. Keep human principal identity in FORTRESS, device identity in Commander, and private namespace identity in IZAKHONO Identity.
4. **One execution boundary:** the verified authorized HOST adapter executes commands in a separately registered environment. NODE01 remains logical workload identity, not a server.
5. **One authoritative evidence path:** NODE01 emits task receipts/events; FORTRESS and Runtime Fabric emit their own decision/runtime events; a governed evidence service correlates and durably retains them. Do not equate the current in-memory observer with this service.
6. **One delivery acceptance owner:** Execution OS decides whether an objective is complete based on acceptance evidence from all contributing systems.
7. **Persistence is not yet assigned:** Runtime Fabric is the target owner for runtime state; the production persistence engine, database ownership, migration authority and atomic transaction boundary remain unresolved and require explicit owner confirmation.

### Phase 0 exit assessment

| Exit criterion | Result |
|---|---|
| Existing component responsibilities mapped | <b>Completed</b> at source/documentation level |
| Canonical target ownership proposed | <b>Completed</b>; persistence owner remains explicitly unresolved |
| Existing interfaces and gaps inventoried | <b>Completed</b> for reviewed sources |
| Runtime/production registration proven | <b>Not met</b> |
| Database owner and migration authority confirmed | <b>Not met</b> |
| Durable cross-system audit transaction proven | <b>Not met</b> |
| Provider capability matrix empirically validated | <b>Not met</b> |
| Automated tests executed | <b>Not run</b>; this was read-only source reconciliation |

**Disposition:** Phase 0 documentation and ownership mapping are complete. Phase 0 production-readiness gates are not complete. Proceed to Phase 1 contract design only as a non-deploying, reviewable specification and test-fixture exercise. Do not implement persistence migrations, enable execution, register assumed adapters, or change production state until the unresolved owners and gates are confirmed.
