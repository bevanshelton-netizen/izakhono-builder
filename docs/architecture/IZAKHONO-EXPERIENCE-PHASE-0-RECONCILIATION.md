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
