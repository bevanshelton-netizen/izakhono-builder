# IZAKHONO Intelligent Operating Ecosystem Architecture
## Version 1.0 — Strategic and Logical Architecture

- **Status:** Proposed architecture baseline; documentation only
- **Date:** 25 November 2026
- **Repository:** `bevanshelton-netizen/izakhono-builder`
- **Scope:** Cross-product logical architecture, shared platform capabilities, governance, integration contracts and phased delivery
- **Authority:** Subject to owner review and approval; this document does not authorise production changes, expenditure, infrastructure provisioning or service activation

---

## 1. Purpose

IZAKHONO is being developed as an independently governed technology ecosystem: a family of infrastructure capabilities, software products, intelligence services and business applications that share a coherent foundation without becoming one inseparable application.

The purpose of this document is to establish a common architectural direction, clarify system boundaries, identify shared contracts and define the conditions under which the ecosystem can evolve safely. It is a strategic and logical architecture, not a claim that every described capability is implemented, production-ready, certified or commercially available.

The ecosystem must be capable of helping organisations:

1. understand markets, demand, competitors and digital visibility;
2. understand customer, employee and stakeholder experience;
3. coordinate specialised AI agents under explicit authority;
4. create, validate, operate and improve software;
5. host and deliver applications using an owned-first infrastructure strategy; and
6. measure outcomes and use verified evidence to guide the next improvement cycle.

**Architectural proposition:** understand the environment, understand the people, reason from evidence, decide under governance, execute with authority, measure outcomes and improve.

## 2. Foundational principles

1. **Owned-first control:** IZAKHONO owns its source-of-truth architecture, control-plane logic, policy model, product definitions and operational records. External services may be optional adapters or capacity sources, not the identity of the platform.
2. **Provider independence and reversibility:** integrations must be replaceable. Provider-specific details stay behind explicit adapters and contracts. Avoid architectural dependence on a single vendor where a practical alternative exists.
3. **NODE01 identity invariant:** **NODE01 IS SOFTWARE. NODE01 IS NOT A MACHINE.** NODE01 is a logical software/runtime identity. Physical, virtual, containerised or distributed execution environments are separate, replaceable infrastructure substrates. The binding between them must be explicit and verifiable. The existing [NODE01 Identity Standard](../../architecture/NODE01-IDENTITY-STANDARD.md) is authoritative.
4. **Security and authority by design:** FORTRESS governs identity, authentication, authorisation, secrets access, policy enforcement and audit. Agents cannot grant themselves authority.
5. **Evidence before conclusions:** observed facts, derived interpretations, recommendations and executed actions must remain distinguishable and traceable.
6. **Modular product boundaries:** each product owns its domain behaviour and data responsibilities while consuming shared platform contracts.
7. **Tenant isolation:** customer data, credentials, configuration, events and operational actions must be isolated and scoped to an authorised tenant.
8. **Privacy and data minimisation:** collect only what is necessary, document purpose and lawful basis, define retention, and support applicable privacy obligations including POPIA where relevant.
9. **Observable operation:** important workflows emit structured, correlated, access-controlled and auditable events.
10. **Cost discipline:** no paid dataset, hosting service, infrastructure resource, model endpoint or other chargeable capability may be procured, provisioned or activated without explicit owner approval.
11. **Evidence-gated readiness:** a successful build or CI run is not proof of production hosting, public reachability, security certification, resilience, compliance or customer acceptance.
12. **Progressive delivery:** preserve existing working systems and investments; introduce shared contracts incrementally and avoid speculative rewrites.

## 3. Ecosystem logical architecture

The ecosystem is composed of product domains and shared platform capabilities.

### 3.1 Product domains

| Domain | Primary responsibility | Owns / produces |
|---|---|---|
| IZAKHONO SIGNAL | External market, search, AI-answer, GEO and reputation intelligence | Search observations, prompt tests, source evidence, trends, visibility assessments and recommendations |
| IZAKHONO EXPERIENCE | Customer, employee, stakeholder and service experience intelligence | Surveys, feedback, experience metrics, cases, resolution evidence and improvement signals |
| IZAKHONO AI WORKFORCE | Specialised agent coordination and governed work execution | Agent definitions, task plans, tool requests, decisions, approvals and execution evidence |
| IZAKHONO CODE | Software creation, engineering and maintenance | Project workspaces, source changes, tests, build evidence and release candidates |
| IZAKHONO INFRASTRUCTURE / HOST | Owned-first hosting and runtime infrastructure capabilities | Infrastructure inventory, provisioning records, runtime bindings, service state and operational evidence |
| IZAKHONO MULTI-EDGE | Edge delivery and multi-network traffic orchestration | Routing policy, delivery configuration, edge telemetry, failover and security events |
| J.A.R.V.I.S. | Intelligent assistance and operational interaction | User-facing assistant workflows and authorised operational requests |
| CONNECTA | Connected business, customer and stakeholder workflows | Application-specific records and business processes |

These are logical domains. Their deployment topology may vary. A domain may consist of multiple services or modules, and multiple domains may share infrastructure, but their authority and data ownership must remain explicit.

### 3.2 Shared platform capabilities

| Shared capability | Responsibility |
|---|---|
| IZAKHONO AI | First-party assistant experience, model gateway, conversation, memory, retrieval and model evaluation; see `IZAKHONO-AI-FIRST-PARTY-PLATFORM-ARCHITECTURE-V1.md` |\n| FORTRESS | Identity, authentication, authorisation, policy, secrets access, approvals and audit |
| Runtime Fabric | Coordination of separately managed execution environments, runtime placement/bindings and execution lifecycle controls |
| NODE01 software runtime | Stable logical software/runtime identity and its governed software capabilities; never a physical host |
| DATABASE | Persistence services, data lifecycle, backup/restore and tenant-scoped data access |
| EDGE | Shared edge capabilities such as ingress, TLS termination, caching and origin protection where implemented |
| MULTI-EDGE control | Coordination across owned and optional external delivery networks |
| Event and integration fabric | Versioned events, service contracts, connector adapters and delivery/retry semantics |
| Observability | Correlated logs, metrics, traces, health and operational evidence |
| Policy and configuration | Versioned configuration, policy evaluation and environment-specific settings |

The table describes responsibilities, not a claim that every capability currently exists as a complete service. Existing implementations must be assessed before any consolidation or replacement is proposed.

### 3.3 Conceptual relationship

```text
                    PEOPLE / CUSTOMERS / OPERATORS
                                |
                  J.A.R.V.I.S. / CONNECTA / APPS
                                |
        +---------------- PRODUCT DOMAINS ----------------+
        |                                                  |
     SIGNAL       EXPERIENCE       AI WORKFORCE       CODE
        |              |                |               |
        +--------------+----------------+---------------+
                                |
                 SHARED CONTRACTS / EVENT FABRIC
                                |
       +---------------- GOVERNED PLATFORM ----------------+
       |                                                    |
   FORTRESS       Runtime Fabric       DATABASE       OBSERVABILITY
       |                 |                |                 |
       +-----------------+----------------+-----------------+
                                |
          NODE01 SOFTWARE IDENTITY / GOVERNED RUNTIME LOGIC
                                |
               EXPLICIT RUNTIME BINDING (VERIFIED)
                                |
       SEPARATELY MANAGED EXECUTION ENVIRONMENTS / HOSTS
                                |
           EDGE / MULTI-EDGE / NETWORK / STORAGE / COMPUTE
```

The diagram is logical. It does not prescribe one deployment topology and must not be read as equating NODE01 with the execution environment.

## 4. Product domain specifications

### 4.1 IZAKHONO SIGNAL — external intelligence

**Mission:** provide evidence-based understanding of market demand, search behaviour, AI-generated answers, brand discoverability, competitors and reputation.

Core capabilities:

- **SIGNAL DISCOVER:** search intent, audience questions, demand shifts and emerging topics.
- **SIGNAL WATCH:** brand and competitor mentions in supported AI answer engines and digital sources.
- **SIGNAL GEO:** technical and content discoverability assessments for generative answer systems.
- **SIGNAL REPUTATION:** narratives, source quality, accuracy concerns and emerging reputation risks.
- **SIGNAL ANALYSE:** cross-market comparisons, trend analysis, evidence synthesis and opportunity assessment.

Specialised agent roles may include Search Monitor, Trend Detector, AI Answer Monitor, Source Verification, Competitor Watch, Reputation Guardian, GEO Optimiser, Opportunity Analyst, Strategic Intelligence and Outcome Evaluator.

A prompt/answer observation must retain, where available: exact prompt, language, country/market, timestamp, platform/model, model or product version, browsing/retrieval conditions, answer, citations, source URLs, collection method and applicable licence/terms. AI answers vary by context. A result is a contextual observation, not a universal ranking or guaranteed representation.

GEO work may assess entity consistency, authoritative content, structured data, technical accessibility, crawl/index conditions, citations and factual completeness. Optional files such as `llms.txt` are not guaranteed discovery mechanisms. No feature may promise AI citations, rankings or recommendations.

### 4.2 IZAKHONO EXPERIENCE — experience intelligence

**Mission:** turn customer, employee, stakeholder and service feedback into measurable, closed-loop improvement.

Core capabilities:

- configurable surveys and feedback collection across supported channels;
- customer, employee, stakeholder and service journey measurement;
- NPS, CSAT and CES, with documented calculation and sampling methods;
- sentiment and topic analysis of open-ended feedback;
- case creation, assignment, escalation and resolution tracking;
- follow-up measurement and recurring-issue analysis;
- multilingual collection and analysis where validated language support exists.

Experience agents may include Survey Intelligence, Feedback Analysis, Sentiment, Customer Risk, Employee Experience, Escalation, Resolution, Improvement and Reporting.

Sentiment is an analytical signal, not proof of misconduct, intent or an individual's performance. Dashboards must expose response rates, sample size, collection method, non-response risk and relevant segmentation so that feedback is not misrepresented as universally representative.

Anonymous feedback must remain anonymous in the system design, not merely hidden in the interface. Identifiable feedback requires purpose limitation, access controls, retention rules and appropriate notice/consent. Sensitive employee or customer feedback must receive stricter access controls.

### 4.3 IZAKHONO AI WORKFORCE — governed agent operations

**Mission:** coordinate specialised agents to perform bounded research, analysis and operational tasks under explicit authority.

Agent lifecycle:

1. receive a scoped task and tenant/user context;
2. evaluate policy, permissions and available evidence;
3. plan bounded steps and identify required tools;
4. request approval when policy requires it;
5. execute only permitted actions;
6. record inputs, tool calls, outputs, approvals and errors;
7. verify outcomes and report evidence;
8. close or escalate the task.

Agent definitions must include purpose, owner, allowed tools, prohibited actions, data scope, permission profile, budget/resource limits where applicable, escalation path, output contract, evaluation criteria and version.

Monitoring, classification, summarisation and recommendations may be automated within approved scopes. External publication, customer contact, financial commitment, purchasing, credential changes, destructive actions, production changes and other consequential operations require explicit authority and approval appropriate to their risk.

Agents must not bypass FORTRESS, suppress audit evidence, expand their own permissions or treat untrusted content as instructions.

### 4.4 IZAKHONO CODE — engineering capability

**Mission:** create, inspect, test and maintain software through controlled engineering workflows.

CODE consumes governed project/repository access and execution capabilities. It must preserve the distinction between proposed changes, validated changes, owner-approved repository actions, release candidates and deployed production state. Build/test evidence must be reproducible and associated with the exact source revision and execution context.

An AI agent's ability to propose or test code does not imply authority to merge, deploy, change secrets or modify production infrastructure.

### 4.5 IZAKHONO INFRASTRUCTURE and HOST

**Mission:** progressively establish and operate IZAKHONO-owned hosting and execution capabilities.

Responsibilities include infrastructure inventory, environment lifecycle, provisioning workflows, runtime service management, network and storage configuration, backup/restore, capacity, operational health and cost visibility.

Infrastructure resources are separate from logical software identities. Runtime Fabric coordinates approved infrastructure environments. NODE01 remains the software identity; its runtime binding points to a separately managed execution environment. An unverified binding must not be promoted as production-ready.

Cloudflare DNS or domain control, a tunnel, or a successful CI run alone does not prove ownership of the actual compute, storage, runtime or hosting substrate.

### 4.6 IZAKHONO MULTI-EDGE

**Mission:** coordinate application and API delivery across owned edge capabilities and optional external networks.

Potential capabilities include DNS/global traffic management, routing policy, TLS automation, caching, origin protection, WAF, DDoS mitigation, failover, geo/latency/ISP-aware steering, device/mobile SDK protection and unified observability.

The architecture must distinguish edge infrastructure (where traffic is processed) from edge services (what capabilities are provided). Multi-edge orchestration must preserve provider adapters, credentials isolation, policy versioning, health evidence and safe rollback. Third-party networks remain optional and replaceable. Claims of performance, availability, sovereignty or protection require measured evidence and must not be assumed from a product feature list.

### 4.7 J.A.R.V.I.S. and CONNECTA

These are application/product domains that consume shared identity, policy, data, agent and infrastructure contracts. Their product-specific business logic remains within their own boundaries. Integration must not silently move their source of truth or production hosting to an external provider.

## 5. Shared data and evidence model

The ecosystem should converge on interoperable, versioned contracts without forcing every product into one database schema.

### 5.1 Common envelope

Cross-domain events and evidence records should carry a common envelope, adapted to the relevant transport:

- `event_id`: globally unique event identifier;
- `event_type` and `schema_version`;
- `occurred_at` and `recorded_at` timestamps;
- `tenant_id` where tenant-scoped;
- `actor_type`, `actor_id` and authority context;
- `correlation_id` and optional `causation_id`;
- `source_domain` and `source_system`;
- `classification` and data-handling label;
- `payload` conforming to the versioned event schema;
- integrity/provenance metadata where required.

Do not put secrets, access tokens or unnecessary personal data into event payloads or logs.

### 5.2 Evidence classes

Every intelligence workflow must distinguish:

1. **Observation:** directly collected or measured data, with source and collection context.
2. **Interpretation:** an analytical conclusion derived from one or more observations, with method and confidence.
3. **Recommendation:** a proposed course of action, including rationale, expected outcome and uncertainty.
4. **Decision:** an authorised human or policy decision, with actor, scope and timestamp.
5. **Action:** an operation actually attempted or completed, with authority and execution record.
6. **Outcome:** measured result after the action, including whether the intended effect occurred.

A generated summary must never be represented as a raw observation. An intended action must never be represented as a completed action.

### 5.3 Data ownership and interoperability

Each domain is authoritative for its own business records. Shared identifiers and event contracts enable correlation; they do not grant every domain unrestricted access to every record. Cross-domain reads must be purpose-scoped, tenant-scoped and authorised through FORTRESS.

Prefer explicit APIs/events over direct cross-domain database writes. Data replication or analytics projections must identify their source, freshness, transformation and retention. Deletion, correction and retention policies must propagate where legally and technically required.

## 6. Integration and API standards

- Use documented, versioned APIs for synchronous commands and queries.
- Use versioned domain events for asynchronous facts and state transitions.
- Define idempotency keys for retryable commands that may create side effects.
- Define timeout, retry, dead-letter and reconciliation behaviour.
- Use explicit tenant and actor context; never trust caller-supplied tenant identity without authentication and authorisation.
- Validate schemas at service boundaries and reject unknown or invalid authority context.
- Keep provider-specific API details inside connector adapters.
- Record connector provenance, source terms, rate limits, data freshness and failure state.
- Prefer additive schema evolution; breaking changes require a new version and migration plan.
- Do not create a shared database as a shortcut around domain ownership.

## 7. Security, governance and privacy

FORTRESS is the authoritative governance boundary for identity and permissions.

Minimum requirements:

- strong authentication for users, services and agents;
- least-privilege, role- and attribute-aware access where appropriate;
- tenant isolation across storage, queues, cache, search indexes and telemetry;
- secrets stored and retrieved through approved secret-management paths;
- short-lived credentials and rotation procedures where supported;
- explicit approval gates for consequential actions;
- tamper-evident or otherwise protected audit records appropriate to risk;
- policy versioning and decision traceability;
- secure defaults, input validation, output handling and dependency review;
- incident detection, response and recovery procedures;
- privacy notices, purpose limitation, minimisation, retention and data-subject processes aligned to applicable law, including POPIA where relevant.

Compliance is not inferred from architecture diagrams. Any claim of certification or regulatory compliance requires a separate scoped assessment, implementation evidence and appropriate independent verification.

## 8. Runtime, deployment and operational model

### 8.1 Identity and substrate separation

The canonical distinction is:

- `logical_node_id = NODE01`
- `identity_type = software-runtime`
- execution environment locator = separate, independently managed value;
- runtime binding = explicit relationship between software identity and environment;
- binding status = verified, unverified, suspended or retired, with evidence.

Never derive NODE01 identity from a hostname, IP address, machine fingerprint, VM ID, serial number, cloud resource ID or container ID. Replacing an execution environment must not change NODE01's logical identity. Never describe an execution environment as NODE01.

### 8.2 Deployment lifecycle

A production promotion should require, as applicable:

1. approved source revision and reproducible build evidence;
2. policy and security checks;
3. verified runtime binding and eligible execution environment;
4. approved configuration and secrets references;
5. database migration ownership, reviewed plan and approved runner;
6. backup and recovery evidence appropriate to the change;
7. health checks, observability and rollback plan;
8. DNS, TLS, ingress and origin validation where public exposure is intended;
9. end-to-end acceptance and accountable owner approval.

CI success is necessary evidence for some releases, but never sufficient proof of production readiness.

### 8.3 Resilience and recovery

Each production service must define availability objectives appropriate to its purpose, dependency map, backup scope, recovery point and recovery time objectives, restore test schedule, failover behaviour and incident owner. Multi-edge routing does not by itself prove application resilience: origin, database, identity, queues, secrets and operational dependencies must also be considered.

## 9. Observability and measurement

Common operational telemetry should include service health, request/error/latency metrics, queue depth and age, resource utilisation, dependency health, policy denials, agent task outcomes, connector freshness, audit events and cost attribution where available.

Telemetry must be tenant-safe and avoid unnecessary sensitive content. Correlation identifiers should connect requests, events, agent tasks, approvals and actions without exposing secrets.

Product outcome metrics must be distinguished from platform health metrics. Examples:

- SIGNAL: observation coverage, source freshness, evidence completeness, trend validation and attributable qualified opportunities.
- EXPERIENCE: response rate, NPS/CSAT/CES, resolution time, repeat issue rate and follow-up completion.
- AI WORKFORCE: task success, evidence completeness, policy-denial rate, approval latency, escalation rate and verified outcome rate.
- CODE: reproducible build rate, test outcomes, change failure rate and review/acceptance evidence.
- INFRASTRUCTURE: service availability, restore-test success, capacity headroom, provisioning success and cost per service.
- MULTI-EDGE: delivery latency, cache effectiveness, origin health, failover success and security-event handling.

Metrics must include definitions, units, sampling windows, source and limitations. Vendor claims and model-generated estimates must not be presented as measured IZAKHONO outcomes.

## 10. Commercial and tenant model

The platform should support a multi-tenant commercial model while preserving domain-level isolation and product independence.

A tenant boundary should cover identities, users, roles, product entitlements, configuration, data, events, agent workspaces, connectors, audit history and usage records. Shared infrastructure must not imply shared customer data.

Commercial plans, entitlements and usage measurement must be explicit and auditable. Do not introduce hidden AI-credit wallets, per-prompt charges or per-action billing inconsistent with the approved IZAKHONO commercial model. Any paid third-party dependency or usage-based cost must be visible and approved before activation.

## 11. Phased implementation roadmap

Phases are dependency-oriented. They are not dates or declarations of completion.

### Phase 1 — Architecture consolidation
- review existing product and infrastructure specifications;
- map current implementations to the logical domains in this document;
- identify duplicate responsibilities, gaps and conflicting contracts;
- establish architecture decision records (ADRs), naming rules and ownership;
- define shared identity, tenant, event, audit and evidence contracts.

**Exit evidence:** reviewed system inventory, approved boundaries, dependency map, ADR index and versioned contract proposals.

### Phase 2 — Intelligence foundations
- define SIGNAL observation, prompt-test, source and interpretation schemas;
- define EXPERIENCE survey, response, metric, case and resolution schemas;
- establish connector governance, provenance and licensing review;
- define multilingual support levels and validation requirements;
- specify baseline reporting and evaluation methods.

**Exit evidence:** reviewed domain specifications, schemas, privacy assessments and test fixtures. No expensive dataset purchase is implied.

### Phase 3 — Governed AI Workforce integration
- catalogue agent roles, tools, scopes and prohibited actions;
- integrate policy evaluation, approval workflows and audit evidence;
- define idempotent task execution, retries, escalation and verification;
- build evaluations for accuracy, safety, evidence quality and task completion.

**Exit evidence:** passing policy and workflow tests, bounded tool permissions, auditable task records and explicit owner-approved pilot scope.

### Phase 4 — Infrastructure and Multi-Edge capability
- inventory existing owned infrastructure and verified runtime bindings;
- validate HOST, Runtime Fabric, DATABASE, EDGE and FORTRESS responsibilities;
- establish backup/restore, observability and deployment controls;
- design edge adapters and routing policy with measurable acceptance criteria;
- keep optional provider integration reversible.

**Exit evidence:** verified execution substrate and runtime binding, tested recovery, approved security posture, measured edge behaviour and owner-approved production readiness.

### Phase 5 — Product integration
- integrate CODE, J.A.R.V.I.S., CONNECTA and other applications through shared contracts;
- validate tenant isolation and cross-domain permissions;
- remove duplicated platform functions only after replacement evidence exists;
- conduct end-to-end workflow and failure testing.

**Exit evidence:** versioned integration tests, tenant-isolation evidence, rollback plans and product-owner acceptance.

### Phase 6 — Commercialisation and expansion
- define support, service levels, onboarding and incident operations;
- validate pricing, entitlements, metering and cost attribution;
- establish customer data export, retention and exit processes;
- expand languages, markets, edge locations and connector coverage only when justified by evidence.

**Exit evidence:** approved commercial terms, operational support model, customer acceptance and transparent cost model.

## 12. Architecture decision records required

The following decisions must be recorded before their respective implementation becomes binding:

1. authoritative identity and tenant model;
2. canonical event envelope and schema governance;
3. domain ownership and API/event boundaries;
4. FORTRESS policy and approval semantics;
5. Runtime Fabric responsibilities and runtime-binding verification;
6. DATABASE ownership, backup and restore standards;
7. agent tool registry, task lifecycle and risk tiers;
8. connector licensing, provenance and data-retention rules;
9. deployment promotion and rollback controls;
10. product entitlements, metering and cost approval.

An ADR must state context, decision, alternatives, consequences, owner, status and review trigger. This document does not silently decide implementation details that require repository inspection or owner approval.

## 13. Risks and explicit non-goals

### Risks to manage
- premature centralisation that creates a single fragile control plane;
- unclear ownership between product domains;
- unverified runtime or infrastructure assumptions;
- excessive data collection and tenant leakage;
- agent authority escalation or unreviewed consequential actions;
- unlicensed or unstable external data sources;
- AI-answer variability mistaken for a universal ranking;
- vendor marketing claims mistaken for measured performance;
- multi-edge complexity without tested origin and data resilience;
- cost growth from models, datasets, infrastructure and connector usage.

### Non-goals of this architecture document
- implementing or deploying services;
- provisioning or purchasing infrastructure;
- buying datasets, domains, certificates or subscriptions;
- changing DNS, credentials, permissions or production configuration;
- authorising agents to publish, contact customers or spend money;
- asserting that any unverified feature is live, secure, certified or production-ready;
- replacing existing product architectures without a separate evidence-based migration decision.

## 14. Definition of architecture readiness

This architecture is ready to guide implementation when:

- product and platform boundaries have named accountable owners;
- current-state inventory distinguishes implemented, partial, planned and unverified capabilities;
- NODE01 software identity is consistently separated from execution infrastructure;
- shared contracts have schemas, versioning and compatibility rules;
- FORTRESS authority and approval requirements are testable;
- tenant and data boundaries are documented and tested;
- each phase has measurable acceptance evidence;
- costs and external dependencies are visible and require approval;
- operational, recovery and rollback responsibilities are assigned.

A document being merged does not make the architecture implemented. Each product and capability must independently satisfy its acceptance criteria.

---

## Appendix A — Canonical vocabulary

| Term | Meaning |
|---|---|
| NODE01 | Stable logical software/runtime identity; never a machine |
| Execution environment | Separately managed physical, virtual, containerised or distributed substrate |
| Runtime binding | Explicit relationship between software identity and execution environment |
| Runtime Fabric | Coordination of approved runtime environments and lifecycle controls |
| FORTRESS | Identity, access, policy, approval, secrets governance and audit |
| SIGNAL | External market, search, AI-answer, GEO and reputation intelligence |
| EXPERIENCE | Customer, employee, stakeholder and service experience intelligence |
| AI WORKFORCE | Governed coordination of specialised agents |
| MULTI-EDGE | Orchestration of owned and optional external edge delivery capabilities |
| Observation | Directly collected or measured evidence |
| Interpretation | Analysis derived from observations |
| Recommendation | Proposed action, not an authorised decision |
| Decision | Human or policy-authorised choice |
| Action | Attempted or completed operation with execution evidence |
| Outcome | Measured result of an action |

## Appendix B — Source-of-truth rule

This document establishes the cross-ecosystem strategic and logical direction. Product-specific specifications, repository implementations, security standards and approved ADRs provide implementation detail. Where a conflict exists, mandatory security and identity standards take precedence; otherwise, the conflict must be recorded and resolved through an owner-reviewed ADR. No implementation may weaken the NODE01 identity invariant or FORTRESS governance.

## Appendix C — Status vocabulary

Use these labels in future architecture and release reporting:

- **Implemented:** code/configuration exists and has been inspected.
- **Tested:** defined tests passed against a stated revision/environment.
- **Verified:** the required operational fact has been independently evidenced.
- **Production-ready:** all applicable security, runtime, recovery, operational and acceptance gates passed.
- **Planned:** approved direction without implementation evidence.
- **Unverified:** evidence is missing, stale or insufficient.
- **Blocked:** a named dependency prevents safe progress.

Never infer one status from another.
