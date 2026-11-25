# IZAKHONO EXPERIENCE — Phase 0 Architecture Reconciliation

**Date:** 2026-11-25  
**Status:** Read-only repository inspection; findings are evidence-bounded  
**Related proposal:** `IZAKHONO-EXPERIENCE-ARCHITECTURE-V2.md`  
**Scope:** Main-branch documentation and specifically identified architecture branches  
**No implementation, deployment, migration, provider activation or production mutation was performed.**

## 1. Executive finding

The repository already contains meaningful shared platform foundations that EXPERIENCE must reuse. The clearest confirmed owners are:

- **NODE01 Agent Fabric:** specialist-agent/task orchestration, bounded tool execution, deterministic execution boundary and evidence receipts.
- **FORTRESS:** default-deny security policy decision boundary, entity-scoped authorization, credential/data handling restrictions and controlled external egress policy.
- **IZAKHONO Execution OS:** objective lifecycle, approval gates, delivery states and completion evidence.
- **IZAKHONO HOST / owned runtime architecture:** owned-first control, edge, runtime, data and mail planes, with PostgreSQL, MinIO and Valkey listed as software baselines.
- **IZAKHONO CONNECT:** communication application foundation, with provider-reversible dependencies and additional production-hardening requirements.

The targeted inspection did **not confirm an existing canonical EXPERIENCE survey, NPS/CSAT/CES, response, feedback-case or customer-health domain implementation on main**. This is a bounded finding, not proof that no related code exists elsewhere: repository code search returned no matching results, and the inspection did not exhaustively enumerate every branch, directory, generated artifact or external service.

The architecture direction is therefore sound, with one important adjustment: EXPERIENCE should be a domain capability and set of contracts on top of existing shared foundations, not a second agent runtime, policy engine, communication platform, execution state machine or presumed database.

## 2. Evidence reviewed

The following repository artifacts were fetched and inspected:

| Artifact | Ref | Confirmed responsibility / evidence |
|---|---|---|
| `README.md` | `main` | Owned-first platform, native Builder, HOST, FORTRESS, provider reversibility and NODE01 software identity rule |
| `architecture/NODE01-IDENTITY-STANDARD.md` | `main` | NODE01 is software; execution environment and runtime binding are separate |
| `products/node01-agent-fabric/README.md` | `main` | Objective planning, task graph, specialist agents, policy gate, scheduler, evidence and execution receipt |
| `products/node01-agent-fabric/ORCHESTRATION-V1.md` | `main` | Execution/correlation IDs, registered tools, fail-closed behavior, evidence hashes and bounded orchestration |
| `products/node01-agent-fabric/TOOL-FABRIC.md` | `main` | Registered allowlisted tools, risk matching, approval requirements and evidence hashes |
| `products/node01-agent-fabric/PERSISTENT-RUNTIME.md` | `main` | SQLite reference durability adapter, task leases, retries and dead-letter semantics; not proof of production distributed operation |
| `products/izakhono-fortress/README.md` | `main` | Default-deny policy decision point, entity-scoped requests and restrictions on external AI/data egress |
| `products/izakhono-execution-os/EXECUTION-CONTRACT.md` | `main` | Objective lifecycle, explicit approvals, completion criteria and evidence model |
| `products/izakhono-host/OWNED-RUNTIME-V1.md` | `main` | Owned control, edge, runtime, data, mail and provisioner planes; software baseline and separate activation evidence gates |
| `products/izakhono-connect/README.md` | `main` | Messaging, realtime, offline outbox and RLS foundation; TURN, push credentials and other production hardening remain outstanding |
| `docs/IZAKHONO_UNIFIED_EXECUTION_ARCHITECTURE.md` | `main` | Shared tool-adapter contract, orchestration, long-running jobs, continuity, approval and verification model |
| `docs/architecture/IZAKHONO-AI-WORKFORCE-ARCHITECTURE-V1.md` | `feat/ai-workforce-governance-architecture-v1` | Proposed responsibility boundaries for FORTRESS, NODE01 Agent Fabric, Runtime Fabric, authorized HOST execution and Execution OS |

The AI Workforce architecture file was verified on its named feature branch, not on main. It must be treated as a separate proposed architecture artifact until its merge and integration status are independently verified.

## 3. Canonical ownership matrix

| EXPERIENCE concern | Canonical owner / disposition | Phase 0 finding |
|---|---|---|
| Specialist-agent registry, task graph, scheduler and bounded tool execution | NODE01 Agent Fabric | Confirmed existing owner; EXPERIENCE agents are role/manifest definitions, not a new scheduler |
| Identity, policy decisions, scoped authorization, approval and security enforcement | FORTRESS | Confirmed policy decision boundary; verify enforcement integration per operation |
| Objective lifecycle, approval gates, completion and delivery evidence | IZAKHONO Execution OS | Confirmed existing workflow contract; EXPERIENCE case lifecycle remains a separate domain state machine |
| Runtime registration, scheduling, health and failover | Runtime Fabric | Responsibility described in AI Workforce proposal; concrete authoritative runtime contract/registration must be verified before binding |
| Physical/virtual/container execution environment | Separately managed HOST/infrastructure substrate | Confirmed separation principle; never identify substrate as NODE01 |
| Communication application | IZAKHONO CONNECT | Existing application foundation; not automatically a survey-distribution or notification service contract |
| Owned runtime/data planes | IZAKHONO HOST / owned runtime | Architecture describes PostgreSQL, MinIO and Valkey baselines; authoritative production database, tenant model, migration owner and approved runner are not established by this inspection |
| Survey definitions, survey versions and question bank | EXPERIENCE domain | No canonical implementation confirmed on main |
| NPS/CSAT/CES metric definitions and calculations | EXPERIENCE domain | No canonical implementation confirmed on main |
| Survey eligibility, dispatch and delivery evidence | EXPERIENCE domain plus approved channel adapters | No canonical survey-distribution contract confirmed |
| Raw responses and feedback provenance | EXPERIENCE domain | No canonical implementation confirmed |
| AI feedback analysis and health assessment | EXPERIENCE domain using NODE01 Agent Fabric and FORTRESS-approved inference/tool adapters | No canonical EXPERIENCE analytical implementation confirmed |
| Experience cases, assignment, intervention and follow-up | EXPERIENCE domain | No canonical case lifecycle confirmed |
| Consent, contact preferences and retention | Shared privacy/security policy plus EXPERIENCE purpose-specific records | Exact authoritative consent/preference service not identified; must be resolved before dispatch or sensitive processing |
| Audit and immutable evidence | Existing FORTRESS / platform audit and evidence contracts | Reuse canonical audit interfaces; exact durable audit API/schema and retention guarantees need verification |
| Market expectation and external demand context | SIGNAL | Related intelligence architecture is proposed; do not treat market signals as first-party respondent evidence |

## 4. Critical integration constraints

### 4.1 No duplicate orchestration

The V2 specialist roles must be registered with NODE01 Agent Fabric. Do not build an EXPERIENCE scheduler, agent registry, parallel task graph or independent tool-execution pathway.

The Agent Fabric documentation describes a deterministic core and registered tools. It does not establish that all production model providers, external tools, credentials or autonomous side effects are live.

### 4.2 FORTRESS is the authorization authority

EXPERIENCE may declare required capabilities and request policy decisions. It must not issue its own grants or treat a model recommendation, logged-in session or successful application call as authorization.

FORTRESS README describes a localhost-only policy decision endpoint and explicitly says that its first release is a policy decision point, not yet a transparent network firewall. Therefore, do not claim universal network-level enforcement. Each integration must show the actual enforcement point and denial behavior.

### 4.3 Keep case and execution lifecycles separate

An EXPERIENCE case records the business/service issue and its resolution evidence. Execution OS records approved objective delivery. NODE01 records agent task execution and receipts. These records may correlate through identifiers, but must not be collapsed into one state machine or overwrite each other's authority.

### 4.4 Do not assume a database or migration owner

HOST documentation identifies PostgreSQL, MinIO and Valkey in the owned-runtime software baseline. That does not prove which database is authoritative for EXPERIENCE, whether a tenant-isolated production schema exists, who owns migrations, or which runner is approved.

Before implementation, obtain evidence for:
- authoritative database and project/environment;
- canonical tenant/entity identity and isolation strategy;
- data owner and migration approver;
- approved migration runner and execution substrate binding;
- transaction, idempotency and audit guarantees;
- backup, restore, retention and deletion behavior.

No schema or migration is authorized by this report.

### 4.5 CONNECT is not automatically a distribution provider

CONNECT documents messaging and realtime capabilities, but its README also lists push notification credentials and delivery verification among remaining production-hardening requirements. Email, SMS, web embeds and in-app survey delivery require individually verified adapters, policy checks, cost disclosure and delivery evidence. Do not infer a channel is available from the existence of CONNECT.

### 4.6 NODE01 identity remains invariant

NODE01 is software. Any physical, virtual or containerized execution environment is separate, replaceable infrastructure. Runtime binding must identify the environment independently and must be verified before production promotion.

## 5. Gaps that block implementation

| Gap | Evidence required to close it | Gate |
|---|---|---|
| Existing EXPERIENCE source/code inventory | Enumerated repository paths, owners, tests and active PR/branch overlap | Before creating product code |
| Existing intelligence architecture overlap | Review PR #759 and its full file diff; reconcile SIGNAL/EXPERIENCE shared intelligence boundaries | Before architecture merge |
| AI Workforce architecture merge/integration | Verify PR #748 status and compare its contracts with the V2 assumptions | Before agent integration |
| Runtime Fabric authoritative contract | Confirm current canonical interfaces, registration model and health/evidence semantics | Before workload binding |
| Authoritative persistence | Confirm database, tenant/entity model, data ownership, migration authority and runner | Before schema design or writes |
| Consent/contact preference authority | Identify policy and source-of-truth for purpose, consent, revocation, suppression and retention | Before survey distribution |
| Audit/evidence authority | Identify durable event/audit interfaces, integrity guarantees, access and retention | Before case/dispatch implementation |
| Communication adapters | Verify each channel's auth, privacy, cost, delivery, retry and opt-out behavior | Before external communications |
| External model policy | Verify FORTRESS decision and enforcement for each data class/provider/purpose | Before external inference |
| Predictive-model readiness | Establish lawful representative data, labels, validation, calibration, bias/drift evaluation and human review | Before predictive activation |

## 6. Recommended implementation sequence

1. **Close architecture overlap:** reconcile EXPERIENCE V2 with the AI Workforce architecture and the open Intelligence Platform architecture proposal. Define SIGNAL versus EXPERIENCE evidence boundaries.
2. **Confirm shared service contracts:** Runtime Fabric, FORTRESS authorization, audit/evidence, identity/tenant context, consent/preferences and channel adapters.
3. **Confirm persistence governance:** identify the authoritative database, tenant model, migration owner, approved runner and recovery controls. Do not proceed by assumption.
4. **Define EXPERIENCE domain contracts:** programme, journey, survey/version, metric definition, dispatch, response, analysis, case/action and follow-up.
5. **Build deterministic measurement first:** versioned NPS/CSAT/CES calculations and survey/response integrity before AI analysis or prediction.
6. **Add ingestion and human-reviewed feedback analysis:** preserve source evidence and uncertainty.
7. **Add closed-loop case management:** use shared notification/authorization/audit services and idempotent transitions.
8. **Add journey and descriptive relationship health:** only from authorized, sufficiently complete data.
9. **Evaluate predictive models separately:** keep prediction disabled until validation and governance gates pass.

## 7. Phase 0 exit criteria

Phase 0 is **partially complete**. The shared architecture boundaries listed above are confirmed from inspected repository artifacts. Phase 0 is not complete until:
- the active Intelligence Platform proposal (#759) is inspected and reconciled;
- the AI Workforce proposal (#748) status and merge implications are checked;
- Runtime Fabric, audit/evidence and identity/tenant contracts are inspected at their actual canonical paths;
- authoritative persistence and migration governance are explicitly confirmed;
- consent/contact preference ownership is identified;
- survey distribution adapters and their delivery/opt-out guarantees are verified;
- the repository's existing EXPERIENCE code/branch inventory is completed.

## 8. Safety and scope statement

This was a read-only repository inspection followed by documentation planning. It did not create or modify application code, database objects, migrations, credentials, provider accounts, paid services, customer/employee communications, DNS, runtime registrations, infrastructure or production deployments.

Do not interpret architecture documentation, a branch, a pull request, a passing CI job or a model-generated recommendation as proof of implementation, authorization, registration, deployment or production readiness.


## 9. Subsequent discovery — PR #759 contains an existing EXPERIENCE alpha

A follow-up inspection of the active Intelligence Platform proposal identified a first-party EXPERIENCE domain foundation that was not visible on `main` during the initial targeted inspection.

**PR:** [#759 — IZAKHONO Intelligence Platform Architecture v1](https://github.com/bevanshelton-netizen/izakhono-builder/pull/759)  
**Branch:** `feat/izakhono-intelligence-platform-architecture-v1`  
**Comparison against main at inspection:** 9 commits ahead, 0 behind. The PR's seven changed files are all additions.

Confirmed changed files:
- `architecture/IZAKHONO-INTELLIGENCE-PLATFORM-V1.md`
- `products/izakhono-experience/README.md`
- `products/izakhono-experience/domain.py`
- `products/izakhono-experience/identity.py`
- `products/izakhono-experience/test_domain.py`
- `products/izakhono-experience/test_identity.py`
- `.github/workflows/izakhono-experience-ci.yml`

The branch README describes an **alpha domain library, not a public or production service**. Source inspection confirms:
- SQLite tenant-scoped survey, question, response, answer and case records with composite entity/platform scoping;
- survey lifecycle and NPS/CSAT/CES/custom metric identifiers;
- NPS, rating, text and choice question validation;
- anonymous, pseudonymous and identified response modes;
- standard NPS classification and calculation;
- case transitions with resolution-note requirement;
- an IZAKHONO ID session-introspection client and a mandatory fail-closed FORTRESS decision callback;
- unit tests covering NPS, validation, privacy-mode behavior, tenant isolation, case lifecycle and identity/policy denial paths;
- a path-filtered CI workflow for compilation, unit tests and the NODE01 identity invariant.

### Important limitations found in the source

1. The domain foundation uses SQLite. This is a useful deterministic alpha/reference persistence implementation, but it does not establish the production authoritative database or multi-instance persistence strategy.
2. The FORTRESS permission callback is an integration seam. The PR explicitly states the currently inspected FORTRESS implementation does not yet expose the required product-permission decision endpoint. It fails closed; no public HTTP route or survey access is exposed.
3. The current implementation does not provide survey distribution, email/SMS, public survey links, AI sentiment/churn prediction, production migrations or production deployment.
4. The domain source requires further review for transaction atomicity, case transition concurrency/idempotency, append-only audit/evidence, response-to-case workflow policy, data retention/deletion, and production-grade privacy/anonymity guarantees.
5. The CI workflow definition is present. This reconciliation did not independently verify a completed passing run for the PR head.

### Revised finding and decision

The earlier statement that no canonical EXPERIENCE implementation had been confirmed applies only to the inspected `main` branch. It must not be read as saying that no implementation exists anywhere in the repository.

**PR #759 is now the leading existing EXPERIENCE alpha foundation.** PR #760 V2 is an architecture hardening/reconciliation companion, not authorization to create a second implementation. Before any new EXPERIENCE product code is written:
- reconcile the V2 requirements with PR #759's actual domain API and schema;
- avoid duplicating survey, question, response, answer, metric and case entities;
- preserve the alpha's fail-closed security boundary;
- define a migration path from SQLite alpha to the confirmed authoritative persistence owner only after ownership and runner are verified;
- decide whether the V2 specification should be merged into or superseded by the Intelligence Platform architecture proposal after review.

PR #759 remains an open proposal according to the available PR search result; its merge state and latest CI outcome must be checked again before implementation or merge planning.


## 10. Source-level review of the EXPERIENCE alpha

The following observations come from reading the current PR #759 source files. They are engineering review findings, not claims that the code has been executed or that defects have been reproduced.

### Confirmed useful foundation

- The standard NPS calculation uses the correct 0–6 / 7–8 / 9–10 boundaries and returns an unavailable score for an empty sample.
- Composite tenant/platform foreign keys are applied to the survey, question, response, answer and case relationships.
- Response submission validates question ownership, required answers and supported question types.
- Anonymous mode does not persist a respondent reference.
- The identity adapter requires an active ID session, an unexpired timestamp and a literal `True` from the FORTRESS callback; failures deny access.
- The code does not expose an HTTP route or public survey endpoint.

### Required hardening before a wider implementation

1. **Metric-definition integrity:** CSAT and CES currently have metric identifiers and generic rating question validation, but no complete versioned CSAT/CES definitions, scale direction, positive threshold, denominator or aggregation rules.
2. **Survey immutability/versioning:** draft-only question editing is a useful start, but published survey versions, immutable historical instruments and explicit version binding on each response are not yet represented.
3. **Case audit history:** case status is updated in place. Add an append-only transition/action history with actor, reason, timestamp, correlation and evidence reference before operational use.
4. **Concurrency and idempotency:** case transitions do not use an expected-current-state compare-and-set or version number. Define transaction boundaries, concurrent update behavior and idempotency keys.
5. **Response-to-case policy:** the code can open a case for a response, but does not yet implement governed qualification rules, duplicate event handling, case ownership policy or a complete follow-up/verification workflow.
6. **Authorization granularity:** the store factory checks a permission when creating a store, but the store methods themselves do not enforce per-operation policy. A future API/service boundary must not create a long-lived store and assume that one prior decision authorizes every later operation indefinitely. Define permission-to-operation mapping, decision freshness and enforcement at the action boundary.
7. **Identity contract hardening:** the introspection client checks HTTPS and a configured internal key, but production integration still needs verified issuer/audience/service identity, key rotation, response schema/version, revocation behavior, bounded response handling and network policy.
8. **Persistence abstraction:** direct SQLite coupling is suitable for an isolated alpha/test library, but production requires a repository interface and an approved database adapter. No SQLite-to-production migration should be attempted until the authoritative persistence and migration owner are confirmed.
9. **Data lifecycle:** add purpose, collection notice/consent reference where applicable, retention class, access/export/correction/deletion workflows and backup deletion behavior.
10. **Anonymity claims:** omitting respondent_ref is not sufficient to establish anonymity. Review IP/device/request logs, timestamps, small-group reporting and linkage risks before using the term anonymous in customer-facing claims.
11. **Survey input safety:** validate question configuration schemas and choice types, enforce text length and payload size at the service boundary, and guard against malformed JSON/configuration.
12. **Observability and recovery:** define transaction rollback behavior, backup/restore, integrity checks, operational metrics and failure reconciliation before production use.

### Recommended engineering sequence for the alpha

A. Keep PR #759 as the sole existing EXPERIENCE domain implementation line; do not fork a second survey/case data model in PR #760.

B. Review and harden the domain contract with deterministic tests for survey versioning, CSAT/CES definitions, concurrent case transitions, idempotent case creation, audit history and response integrity.

C. Resolve the real FORTRESS permission-decision contract and its enforcement point. Until then, keep the adapter fail-closed and do not expose routes.

D. Confirm authoritative persistence and migration governance; then introduce an adapter behind a repository boundary without changing the alpha's tested domain semantics.

E. Only after the above gates, design distribution, notifications, dashboards, analytics and optional model-based feedback interpretation.

No source code in PR #759 was changed by this review. No tests were run by this inspection.
