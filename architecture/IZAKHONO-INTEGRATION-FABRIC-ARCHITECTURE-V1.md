# IZAKHONO INTEGRATION FABRIC — ARCHITECTURE V1

**Status:** Proposed architecture baseline; documentation-only  
**Version:** 1.0  
**Date:** 25 November 2026  
**Owner:** IZAKHONO  
**Scope:** Shared integration platform for IZAKHONO products, customer systems, enterprise applications and approved institutional partners

---

## 1. Executive direction

IZAKHONO INTEGRATION FABRIC is the governed integration and process-coordination layer through which IZAKHONO products, customer applications, enterprise systems, data sources and approved partners exchange information and coordinate work.

It is more than a conventional Enterprise Service Bus (ESB). It combines API management, reusable connectors, durable messaging, data transformation, workflow orchestration, operational observability, security governance and a developer/customer experience.

The strategic objective is to make IZAKHONO the owner and operator of an extensible integration capability—not merely a reseller or configuration layer for another vendor's integration platform.

The platform must be modular, owned-first, tenant-isolated, auditable, externally reversible and deployable on authorised IZAKHONO-managed execution infrastructure. External services may be supported as optional connectors or replaceable resources; they must not become the identity or unavoidable control plane of the platform.

This document defines architecture and governance. It does not claim that the described capabilities are implemented, deployed, certified or production-ready.

## 2. Design principles

1. **Owned-first:** IZAKHONO owns the integration control plane, contracts, policy model, connector framework and operational records.
2. **Modular, not monolithic:** API gateway, connector runtime, messaging, transformation, orchestration and observability are independently evolvable capabilities.
3. **Contract-first:** Every connector and workflow has versioned schemas, explicit inputs/outputs, error semantics and compatibility rules.
4. **Tenant isolation:** Identity, credentials, configuration, payloads, logs, replay and billing records are isolated by tenant and environment.
5. **Least privilege:** Each connector receives only the scopes, operations and data fields required for its declared purpose.
6. **Durable processing:** Transient failures must not silently lose accepted work. Retries, idempotency, dead-letter handling and reconciliation are explicit.
7. **Human authority:** High-impact, financial, regulated, irreversible or externally consequential actions require policy-defined approval.
8. **Observable by design:** Every execution is traceable across connector, message, workflow and destination boundaries.
9. **Data minimisation:** Exchange only the fields necessary for the approved purpose and retention period.
10. **No false guarantees:** Do not promise universal compatibility, zero cost, exactly-once delivery, uninterrupted service or regulatory compliance without evidence.
11. **Infrastructure separation:** NODE01 is a logical software/runtime identity, never a physical or virtual machine. Execution substrates are separately managed and replaceable.
12. **No unapproved spend:** Infrastructure, connector licences, external services and usage commitments require explicit owner approval.

## 3. Product boundaries and ecosystem relationships

| Platform | Responsibility | Boundary |
|---|---|---|
| IZAKHONO ID | Authenticated identity and session context | Supplies trusted subject/entity context; does not grant product permissions by itself |
| FORTRESS | Authorisation, policy, approvals and audit governance | Independent policy authority; deny by default |
| Super Engine Service Bus | Messaging foundation, if confirmed by repository and runtime inventory | Reuse and harden existing implementation where evidence supports it; do not assume capability from a name |
| INTEGRATION FABRIC | Connector lifecycle, API mediation, data exchange and process coordination | Owns integration contracts and governed execution |
| Runtime Fabric | Coordinates authorised software execution and runtime infrastructure | Execution substrate is separate from NODE01 identity |
| DATABASE | Durable application and integration state | Source-of-truth ownership remains explicit per data domain |
| EDGE / MULTI-EDGE | Network delivery, routing and protection | Does not replace application-level authorisation |
| IZAKHONO CODE | Builds and maintains connector/workflow software through approved development workflows | Cannot silently activate production integrations |
| J.A.R.V.I.S. / AI Workforce | Assists with discovery, mapping, workflow authoring and operations | Agent recommendations are not authority to execute |
| CONNECTA | Business-facing workspace and collaboration experience | May expose Integration Studio functions through governed APIs |

The Integration Fabric is a distinct platform capability. It must not be folded into an unrelated product architecture change merely because those products consume it.

## 4. Logical architecture

### 4.1 Control plane

The control plane manages tenants, environments, connector registrations, connector versions, credentials references, API products, workflow definitions, policies, approvals, quotas and lifecycle state.

It stores metadata and references to secrets, not plaintext credentials. Changes to production configuration are versioned, attributable and auditable.

### 4.2 Data plane

The data plane performs authorised API requests, webhook intake, message delivery, transformations and workflow tasks. It runs only on an approved execution substrate with explicit environment binding, network policy and resource limits.

Control-plane availability and data-plane execution should be separable so that a temporary management outage does not corrupt in-flight durable work.

### 4.3 Core capabilities

**API gateway and mediation**
- API registration, routing and versioning.
- Authentication integration and policy enforcement.
- Schema validation, request limits, quotas and rate limiting.
- Correlation identifiers and structured error responses.
- Controlled inbound and outbound network paths.

**Connector framework and registry**
- Versioned connector manifests and SDK.
- Supported protocol adapters: REST/JSON, GraphQL, webhooks, approved database interfaces, file exchange and messaging protocols as justified.
- Declared scopes, data classifications, supported operations, limits and compatibility.
- Health checks, certification evidence, deprecation and revocation.
- Connector signing/provenance and dependency inventory.

**Messaging and event backbone**
- Durable queues, topics and event routing.
- Publish/subscribe and filtered subscriptions.
- Retry with bounded backoff and dead-letter handling.
- Idempotency keys, deduplication windows and replay protection.
- Ordering guarantees declared per stream; no global ordering assumption.
- Consumer acknowledgement and poison-message isolation.

**Data exchange and transformation**
- Schema registry and versioned contracts.
- Canonical business objects only where they add value; preserve source-specific fields and provenance.
- Mapping, validation, normalisation, enrichment and controlled redaction.
- Duplicate detection and conflict policies.
- Reconciliation between source and destination.
- Lineage and transformation-version recording.

**Workflow orchestration**
- Durable, long-running workflow state.
- Timers, schedules, event triggers and human tasks.
- Explicit state transitions and approval checkpoints.
- Retry, timeout, cancellation and compensating-action semantics.
- Versioned workflow definitions and safe migration rules.
- No assumption that a distributed multi-system workflow is one atomic database transaction.

**Observability and operations**
- End-to-end trace and correlation IDs.
- Structured logs, metrics, execution history and health state.
- Queue depth, latency, throughput, failure and retry monitoring.
- Alert routing and tenant-visible status.
- Operator inspection, safe correction and guarded replay.
- Audit evidence for configuration, approvals and execution.

**Integration Studio**
- Connector catalogue and registration.
- Secure credential authorisation.
- Field mapping and workflow designer.
- Test/sandbox execution and validation reports.
- Approval and activation lifecycle.
- Monitoring, error investigation and usage reporting.

**Commercial metering**
- Measure API calls, message volume, workflow executions, data transfer and resource consumption.
- Publish clear plan limits and overage rules.
- Keep technical metering separate from financial settlement.
- Never imply that usage-based pricing means zero infrastructure cost.

## 5. Connector contract

Every connector must publish a machine-readable, versioned manifest containing at minimum:

- Connector identifier, publisher, version and provenance.
- Supported systems, API versions and protocol.
- Supported operations and operation risk classification.
- Required scopes and permissions.
- Input/output schemas and data classification.
- Credential type and secret-reference requirements.
- Network destinations and egress requirements.
- Rate limits, pagination and timeout behaviour.
- Retryability and idempotency support.
- Webhook signature verification requirements, where applicable.
- Data retention and deletion behaviour.
- Health-check and certification test definitions.
- Known limitations and compatibility matrix.

A connector is not certified merely because it can establish a network connection. Certification requires contract tests, authentication tests, tenant-isolation tests, error/retry tests, security review and documented compatibility evidence.

## 6. Canonical execution lifecycle

1. **Discover:** Identify the source, destination, business owner, data domains and intended outcome.
2. **Classify:** Record data sensitivity, legal/purpose basis, retention and operational risk.
3. **Register:** Register the connector and immutable version with provenance.
4. **Authorise:** Authenticate the owner and obtain narrowly scoped ID/FORTRESS permissions and any external system consent.
5. **Configure:** Reference credentials through the approved secret manager; never place secrets in source code, prompts, logs or connector manifests.
6. **Map:** Validate schemas, field mappings, transformations and conflict behaviour.
7. **Design:** Define trigger, workflow states, retry policy, idempotency strategy and compensating actions.
8. **Test:** Run contract, security, failure-injection and sandbox tests with synthetic or approved test data.
9. **Review:** Obtain required owner, data-owner, security and business approvals.
10. **Activate:** Deploy a versioned configuration to an authorised execution environment.
11. **Observe:** Monitor traces, metrics, queue state, data quality and policy decisions.
12. **Reconcile:** Compare source/destination outcomes and resolve exceptions.
13. **Change or revoke:** Version, suspend, rotate credentials or revoke access with complete audit history.

## 7. Security, privacy and governance

### 7.1 Authority chain

- IZAKHONO ID establishes authenticated identity and trusted subject/entity context.
- FORTRESS evaluates the exact product, tenant/entity, subject, permission, resource and policy context.
- The Integration Fabric enforces the decision at the operation boundary.
- The external system independently enforces its own credentials, scopes and consent.
- All decisions and consequential actions are attributable and auditable.

No connector may infer permission from possession of a token alone. No wildcard permissions, implicit role inheritance or cross-tenant credential reuse.

### 7.2 High-impact actions

Require explicit, policy-defined approval before:
- initiating, releasing or changing payments or transfers;
- issuing refunds, payroll or financial adjustments;
- changing bank or beneficiary details;
- submitting regulatory, tax or government filings;
- changing identity, access or security policy;
- sending sensitive or bulk external communications;
- deleting or irreversibly modifying business records;
- triggering any action whose impact exceeds the configured risk threshold.

Approvals must be bound to the exact action, target, material parameters, tenant and expiry. A material change invalidates the prior approval.

### 7.3 Privacy and data protection

The platform must support POPIA-aware purpose limitation, data minimisation, access control, retention schedules, deletion workflows, data-subject request handling and breach investigation. Applicability and legal obligations must be assessed for each deployment; architecture documentation is not legal certification.

Payloads and logs must avoid unnecessary personal or financial data. Sensitive fields should be redacted or tokenised where operationally feasible. Cross-border transfers require explicit review of applicable legal and contractual requirements.

### 7.4 Operational security

- Encrypt data in transit and at rest.
- Store secrets in an approved secret manager; store references in configuration.
- Rotate and revoke credentials.
- Restrict egress to declared destinations.
- Isolate tenants and environments.
- Apply request, payload, concurrency and resource limits.
- Sign and verify webhooks where supported.
- Protect against SSRF, replay, injection, deserialisation abuse and malicious connector packages.
- Maintain immutable or tamper-evident audit records.
- Perform backup and restore testing for durable state.

## 8. Reliability and consistency model

The platform should default to durable at-least-once delivery with idempotent processing. Exactly-once effects across independent external systems cannot be assumed.

Required controls:
- stable idempotency keys scoped to tenant, connector and operation;
- bounded exponential retry with jitter;
- explicit retryable/non-retryable error classification;
- dead-letter queues and operator workflows;
- deduplication and replay safeguards;
- per-stream ordering only where explicitly supported;
- transactional outbox/inbox patterns where applicable;
- reconciliation for uncertain external outcomes;
- compensating actions for multi-step workflows;
- backpressure, circuit breaking and bulkheads;
- defined retention and expiry for messages and workflow state.

A timeout after a write does not prove that the destination rejected the operation. The platform must query/reconcile the outcome before retrying a potentially consequential action.

## 9. AI-assisted integration

AI capabilities may assist with:
- discovering candidate integration paths;
- proposing field mappings and transformations;
- generating connector scaffolding and contract tests;
- drafting workflows from human-approved specifications;
- explaining errors and suggesting remediation;
- detecting anomalous volumes, delays and data discrepancies.

AI outputs are proposals. They must be validated against schemas, policy and tests. AI must not receive unrestricted secrets or tenant data, silently expand scopes, approve its own actions, alter production policy or autonomously execute high-impact operations.

## 10. Customer and developer experience

The Integration Studio should provide a guided lifecycle:

1. Choose a supported connector.
2. Review publisher, certification status, scopes and limitations.
3. Authorise the external account.
4. Select approved data and operations.
5. Map fields and configure triggers.
6. Test with sandbox or synthetic data.
7. Review security, data and operational impact.
8. Obtain required approvals.
9. Activate a versioned integration.
10. Monitor, reconcile and manage lifecycle.

The developer experience should include connector SDKs, local test harnesses, mock endpoints, schema tooling, example manifests, contract tests, versioning guidance and a controlled certification process.

## 11. Commercial model

Potential offers include:
- integration readiness and architecture assessment;
- starter connector bundles;
- managed integration packages;
- business workflow automation;
- API and event usage plans;
- enterprise and regulated deployment profiles;
- certified connector marketplace and partner programme.

Pricing should be transparent and based on clearly defined entitlements and measured usage. Infrastructure, third-party licences, support obligations, data transfer and overage costs must be visible. Do not promise “zero capex” or “free integration” as an absolute.

## 12. Delivery roadmap

### Phase 0 — Evidence and architecture validation
- Inventory repository, deployed and runtime assets for any existing Super Engine Service Bus, message broker or event implementation.
- Record actual capabilities, ownership, dependencies, test coverage, security posture and operational status.
- Distinguish reusable implementation from naming, prototypes and documentation.
- Approve threat model, data classification, connector contract, permission catalogue and canonical schema strategy.
- Produce a gap analysis and ADRs before selecting or replacing infrastructure.

**Exit gate:** Evidence-backed inventory and owner-approved target design. No duplicate bus or premature technology selection.

### Phase 1 — Minimal owned foundation
- Tenant/environment registry and integration control-plane model.
- Connector manifest and SDK baseline.
- API gateway abstraction and webhook intake.
- Secret references and FORTRESS authorisation boundary.
- Durable messaging abstraction, using verified existing capability where suitable.
- Correlation IDs, audit events and basic observability.
- Isolated sandbox and synthetic test harness.

**Exit gate:** Demonstrable tenant isolation, authentication/authorisation, durable delivery, idempotency and audit in automated tests.

### Phase 2 — First controlled connectors
- Select two or three high-value, low-risk connectors based on internal need and customer evidence.
- Start with read-only operations and inbound webhooks.
- Add schema mapping, reconciliation and failure recovery.
- Publish connector certification evidence and limitations.

**Exit gate:** End-to-end tests, security review, operational runbook and owner acceptance.

### Phase 3 — Governed write operations and workflows
- Introduce write-capable connectors one operation at a time.
- Add approval gates for high-impact actions.
- Add durable workflow state, compensation and reconciliation.
- Conduct failure injection and recovery exercises.

**Exit gate:** Demonstrated safe handling of uncertain outcomes, duplicate delivery, partial failure and revoked authorisation.

### Phase 4 — Integration Studio and ecosystem
- Customer-facing connector catalogue and setup.
- Visual workflow authoring.
- Developer SDK and partner certification.
- Usage reporting and transparent commercial entitlements.

**Exit gate:** Customer acceptance, support processes, security/privacy review and documented service objectives.

### Phase 5 — Intelligent operations
- AI-assisted mapping, workflow drafting and incident explanation.
- Anomaly detection and operational recommendations.
- Human-reviewed remediation proposals.

**Exit gate:** Evaluation evidence, permission boundaries, auditability and explicit human approval for consequential execution.

## 13. Initial use-case prioritisation

Prioritise use cases using business value, demand evidence, implementation complexity, security risk, data sensitivity, vendor/API stability and support burden.

Candidates for assessment—not claims of existing connectors—include:
- internal IZAKHONO product-to-product events and identity-aware APIs;
- customer CRM and accounting read-only synchronisation;
- payment status and reconciliation webhooks;
- approved file/CSV/SFTP exchange;
- inventory and order status synchronisation.

Specific vendors such as Xero, Sage, QuickBooks or payment providers are candidates only after API, licensing, jurisdiction, security and customer-demand review.

## 14. Acceptance criteria for production readiness

Production readiness must be evidenced, not inferred from a successful build or CI run. At minimum:

- tenant and environment isolation tests pass;
- ID/FORTRESS authorisation is enforced for every protected operation;
- secrets are never exposed in logs, source, prompts or API responses;
- connector manifests and schemas are versioned and validated;
- contract, integration, security and failure-injection tests pass;
- idempotency, retry, dead-letter and replay controls are demonstrated;
- high-impact operations have tested approval gates;
- traceability and audit records cover configuration through outcome;
- backup, restore, retention and deletion procedures are tested;
- network egress and deployment substrate are explicitly authorised;
- monitoring, alerting, incident response and operator runbooks exist;
- privacy, legal, licensing and customer acceptance reviews are complete;
- service objectives and capacity limits are documented;
- costs and external dependencies are disclosed and approved.

## 15. Explicit non-goals for V1

- Replacing every customer's ERP, CRM, accounting or database.
- Claiming universal connector compatibility.
- Building a monolithic ESB before evidence supports the design.
- Treating third-party hosted integration platforms as the IZAKHONO control plane.
- Unrestricted AI access to production credentials or write operations.
- Autonomous payments, payroll, refunds or regulatory submissions.
- Assuming global exactly-once delivery or global message ordering.
- Public activation before security, operational and owner acceptance gates.
- Treating NODE01 as a machine or execution host.

## 16. Immediate next actions

1. Audit the repository and available runtime evidence for the existing Super Engine Service Bus and related messaging components.
2. Produce an evidence-backed reuse/gap report; do not invent implementation status.
3. Map the ID–FORTRESS authorisation contract and existing Runtime Fabric execution boundary.
4. Draft the connector manifest schema, permission catalogue and threat model.
5. Select the smallest internal use case that proves secure, durable, observable integration.
6. Implement only after the architecture and evidence gates are reviewed.

**Architecture decision:** Establish IZAKHONO INTEGRATION FABRIC as a first-class, independently governed platform capability. Reuse the existing Super Engine Service Bus only to the extent that repository and runtime evidence proves it is fit for purpose. Preserve the owned-first architecture, FORTRESS authority, NODE01 identity invariant and explicit owner control over production activation and expenditure.
