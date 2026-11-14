# IZAKHONO AI 20.0 — Enterprise Operating System Architecture

**Status:** Architecture baseline / implementation specification  
**Owner:** IZAKHONO AFRICA (Pty) Ltd  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Branch:** `feature/izakhono-ai-20-operating-system`  
**Design principle:** OWNED-FIRST. EXTERNALLY REVERSIBLE. EVIDENCE-GATED.

## 1. Mission

IZAKHONO AI 20.0 is the coordinated intelligence and execution layer for IZAKHONO AFRICA. It is not a collection of disconnected chatbots or a collection of dashboards. It is one governed operating system that routes work to specialist agents, coordinates cross-functional delivery, enforces policy, records evidence, and measures business outcomes.

The system must reuse and consolidate existing IZAKHONO capabilities before creating new services. The existing IZAKHONO Builder is the native build and provisioning control plane. IZAKHONO CODE remains the source-of-truth repository layer; IZAKHONO CLOUD is the preferred owned runtime; FORTRESS is the security and identity authority. Existing product services are integrated through versioned contracts, not duplicated.

## 2. Non-negotiable architecture constraints

1. **Owned-first:** IZAKHONO-owned infrastructure and source-of-truth state are preferred. External providers are replaceable adapters, never indispensable control-plane dependencies.
2. **NODE01 identity:** NODE01 is a stable logical software/runtime identity, never a physical server, VM, container host, or device. Execution substrates are separately identified and replaceable.
3. **No false readiness:** A deployment, test, domain, backup, security review, or production capability is only marked complete when current evidence proves it.
4. **No secret leakage:** Credentials, tokens, private keys, customer secrets, and sensitive personal data never enter prompts, logs, source control, or agent-to-agent messages unless explicitly required through an approved secret reference.
5. **Least privilege:** Agents receive narrowly scoped, time-bound capabilities. Read access is the default; writes and external actions require explicit policy authorization.
6. **Human control:** Legal commitments, payments, refunds, credit, public statements on behalf of the company, contract acceptance, regulated decisions, destructive operations, and production cutovers require an authorised human approval unless a separately approved policy explicitly delegates that exact action.
7. **Provider independence:** Model, database, queue, storage, email, payment, hosting, and observability integrations use adapters with documented fallback and exit paths.
8. **Idempotency and recovery:** Every mutating workflow has an idempotency key, bounded retries, timeout, dead-letter handling, and compensating action where possible.
9. **Evidence before status:** Each task stores inputs, outputs, actor, policy decision, timestamps, test results, and artifact hashes.
10. **No artificial AI-credit meter:** Internal execution is governed by permissions, capacity, budgets and business plans—not a proprietary per-prompt or per-agent credit wallet.

## 3. Enterprise divisions

The first operating model contains these divisions. A division is an accountability boundary; agents are specialist workers assigned to defined capabilities.

| Division | Mandate | Initial specialist agents |
|---|---|---|
| CEO Command & Strategy | Priorities, portfolio, decisions, escalation | Chief of Staff, Strategy Analyst, Portfolio Controller |
| Sales & Revenue | Pipeline, qualification, proposals, conversion | Outbound Strategist, Discovery Coach, Deal Strategist, Proposal Strategist, Pipeline Analyst, Account Strategist |
| Marketing & Growth | Positioning, campaigns, acquisition, community | Growth Strategist, Content Creator, Campaign Operator, Social Intelligence Analyst, Community Builder |
| Engineering & Product | Product architecture, implementation, APIs, reliability | Product Architect, Frontend Engineer, Backend Engineer, Mobile Engineer, AI Engineer, DevOps Engineer |
| Design & Experience | Research, design systems, usability, brand | UI Designer, UX Researcher, UX Architect, Brand Guardian, Visual Storyteller |
| Finance & Treasury | Cash visibility, budgets, forecasts, controls | Financial Controller, Cashflow Analyst, Budget Analyst, Revenue Assurance |
| Procurement & Supply Chain | Sourcing, supplier due diligence, tender workflows | Procurement Strategist, Supplier Analyst, Tender Analyst, Contract Tracker |
| Operations & Delivery | Work allocation, fulfilment, service delivery | Operations Controller, Project Manager, Workflow Coordinator |
| Legal & Compliance | Obligations, policies, governance, risk | Compliance Analyst, Contract Reviewer, Policy Monitor |
| Research & Intelligence | Market, competitor, customer and opportunity intelligence | Market Researcher, Competitor Analyst, Opportunity Scout |
| Customer Success | Onboarding, support, retention, expansion | Onboarding Specialist, Support Triage, Customer Health Analyst |
| Security & FORTRESS | Identity, threat detection, policy enforcement | Security Analyst, Access Controller, Incident Coordinator |
| People & Capability | Skills, role design, learning and workforce support | Workforce Planner, Learning Coordinator, Role Analyst |
| Business Development | Partnerships, channels, expansion | Partnership Scout, Deal Support, Market Entry Analyst |
| Quality & Assurance | Independent validation and release confidence | Test Architect, QA Analyst, Evidence Auditor, Release Gatekeeper |

Division and agent counts are configuration, not hard-coded product limits. New divisions can be registered without changing the orchestration core.

## 4. Central control plane

The control plane is responsible for:

- **Command intake:** Accept a business objective, request, event, or scheduled task.
- **Intent and scope:** Convert the request into an explicit outcome, constraints, acceptance criteria, and risk class.
- **Planning:** Produce a dependency-aware work graph with measurable outputs.
- **Assignment:** Select agents by capability, policy, availability, cost, and execution history.
- **Execution:** Run tools through scoped capabilities and approved adapters.
- **Coordination:** Exchange typed artifacts and events; do not rely on unstructured prompt-to-prompt handoffs.
- **Quality gates:** Require independent checks for critical outputs.
- **Approval gates:** Pause only the action requiring human authority; continue independent safe work.
- **Evidence ledger:** Persist immutable audit events and artifact hashes.
- **Outcome reporting:** Report verified completion, partial completion, blockers, risk, time and commercial impact.

### Reference flow

`Command → Intent → Plan → Policy Check → Assign → Execute → Verify → Approve (when required) → Release → Measure`

The orchestration core must be model-provider-neutral and must support deterministic workflows without an LLM.

## 5. Standard agent contract

Every registered agent must declare:

- Stable agent ID, name, division, owner and version.
- Purpose, supported task types and explicit exclusions.
- Required inputs and typed output schema.
- Tool capabilities and permission scopes.
- Data classification and retention rules.
- Model/provider preference and deterministic fallback.
- Timeout, retry and concurrency limits.
- Cost/capacity budget and rate limits.
- Risk class and required approval policy.
- Evaluation suite, quality threshold and known limitations.
- Health, availability and last-verified status.

Agents cannot grant themselves permissions, change their own policy, approve their own high-risk output, or mark their own work independently verified.

## 6. Task, event and evidence model

Minimum canonical entities:

- `division`, `agent_definition`, `agent_version`
- `objective`, `task`, `task_dependency`, `task_attempt`
- `workflow`, `workflow_run`, `event`
- `artifact`, `artifact_version`, `evidence_record`
- `policy`, `policy_decision`, `approval_request`
- `capability_grant`, `secret_reference`
- `integration`, `provider_adapter`, `health_check`
- `evaluation_suite`, `evaluation_run`, `incident`
- `business_metric`, `cost_record`, `audit_event`

Every state transition is attributable and time-stamped. Audit records are append-only. Artifacts are content-addressed where feasible. Workflow events use stable IDs and schema versions.

## 7. Risk and approval model

| Risk class | Example | Default control |
|---|---|---|
| R0 — Read | Read internal approved records | Scoped read capability |
| R1 — Draft | Draft email, proposal, campaign, code | Agent may create draft; no external send |
| R2 — Internal write | Update task, CRM note, internal project state | Policy-authorised write, audit event |
| R3 — External communication | Send email, publish post, contact prospect | Human approval unless exact channel/action is delegated |
| R4 — Financial/legal | Pay, refund, sign, accept terms, submit binding bid | Explicit authorised human approval |
| R5 — Destructive/critical | Delete data, rotate production credentials, cut over DNS/runtime | Multi-step verification and authorised human approval |

Approval is scoped to the exact action, payload, target and expiry. A prior approval cannot be reused for a materially changed action.

## 8. Security architecture

- FORTRESS is the policy and identity authority; orchestration must fail closed when required identity or policy introspection is unavailable.
- Service-to-service identity is workload-based, short-lived and scoped.
- Secrets are referenced through a secret manager; plaintext secrets are not placed in agent context.
- Tenant, company, project and customer data are isolated by policy and storage boundaries.
- Prompt injection and untrusted external content are treated as data, never as executable instructions.
- Tool calls are allow-listed, schema-validated, logged and subject to policy.
- Egress is restricted by integration policy; high-risk actions require destination validation.
- Sensitive data is minimised, classified, redacted and retained only as required.
- Security incidents trigger containment, evidence preservation, notification workflow and recovery.
- Dependency, container, source and artifact scanning are part of the release gate.

## 9. Reliability and observability

Required service-level indicators include:

- Workflow success rate and verified completion rate.
- Median and p95 task duration.
- Retry and dead-letter rates.
- Agent availability and timeout rate.
- Policy denials and approval wait time.
- Cost per verified outcome.
- Defect escape rate and rollback rate.
- Customer response and fulfilment time.
- Revenue influenced and revenue actually collected (kept distinct).

The system must support trace IDs across command, workflow, task, agent, tool, artifact and approval. Health checks must distinguish service reachability from functional readiness.

## 10. Integration strategy

Integrations are adapters behind stable contracts. Initial integration domains:

1. IZAKHONO Builder / CODE / CLOUD / FORTRESS.
2. Existing IZAKHONO business applications and project systems.
3. CRM, customer support and communications.
4. Procurement, tender and supplier data.
5. Finance, billing and payment gateways.
6. Email, calendar and approved social publishing.
7. Model inference endpoints, including local-model runtimes.
8. Metrics, logs, tracing, backup and restore.

No external provider is to be embedded as the only way to execute core workflows. Adapter replacement must not require rewriting business logic.

## 11. Implementation sequence and release gates

### Phase 0 — Discovery and consolidation
- Inventory existing IZAKHONO AI, Agent Flow, Execution OS, Command Centre, Builder and product projects.
- Identify canonical services, duplicate implementations, live dependencies and deployment truth.
- Map every integration to its owner, data, permissions, fallback and current evidence.
- Preserve working functionality; do not overwrite or retire projects before migration and rollback plans exist.

**Exit gate:** Signed-off system inventory, dependency map, risk register and target service ownership.

### Phase 1 — Control-plane foundation
- Define canonical schemas and versioned APIs.
- Implement division/agent registry and capability contracts.
- Implement workflow/task state machine, dependency graph and idempotency.
- Implement event ledger, artifact/evidence records and trace propagation.
- Connect FORTRESS identity and policy enforcement.

**Exit gate:** Automated contract tests, policy tests, audit integrity tests and failure/recovery tests pass.

### Phase 2 — First production workflows
Prioritise workflows with measurable commercial value:
- Lead research → qualification → proposal draft → human-approved outreach.
- Tender discovery → compliance checklist → evidence pack → human-approved submission.
- Customer request → triage → assignment → delivery → acceptance.
- Product request → plan → build → test → package → release candidate.

**Exit gate:** End-to-end tests, human approval controls, real operator acceptance and verified evidence.

### Phase 3 — Enterprise expansion
- Enable all divisions through reusable agent contracts.
- Add analytics, budgets, capacity planning, evaluations and service objectives.
- Add business-specific workspaces with strict data separation.
- Add disaster recovery, restore drills, penetration testing and independent assurance.

**Exit gate:** Operational readiness review and tested recovery.

### Phase 4 — Scale and optimisation
- Add multi-model routing, local inference, workload placement and cost optimisation.
- Add agent performance evaluations and controlled version rollouts.
- Add cross-company workflows and customer-facing automation only after security and acceptance gates.

**Exit gate:** Measured reliability, unit economics, security and customer outcomes at target scale.

## 12. Definition of 20.0 acceptance

“20.0” is an engineering ambition, not a self-awarded quality score. No release is called production-ready until evidence demonstrates:

- All critical user journeys pass automated and operator acceptance tests.
- No unresolved critical/high security findings.
- Role, tenant and capability isolation tests pass.
- Approval gates cannot be bypassed through agent prompts or tool inputs.
- Retry, duplicate delivery, timeout, queue outage and provider outage tests pass.
- Backup restoration and rollback are demonstrated, not merely configured.
- Logs and audit evidence are complete without leaking secrets.
- Performance and cost are measured against declared workloads.
- Accessibility, mobile usability and degraded-network behavior are tested where relevant.
- A named operational owner, runbook, escalation path and support process exist.

## 13. Immediate engineering work queue

1. Inventory the existing agent/orchestration and command-centre implementations.
2. Select one canonical control plane; record the reason and migration path.
3. Inspect the existing Builder task, identity, audit, artifact and runtime modules before adding schemas.
4. Define the agent registry and capability contract in the canonical codebase.
5. Define task/workflow/event schemas and idempotent state transitions.
6. Implement FORTRESS-backed authorization and immutable audit evidence.
7. Build a read-only command-centre view before enabling mutating actions.
8. Add one vertical-slice workflow (lead-to-approved-proposal) with independent QA.
9. Run tests and failure injection; fix and rerun.
10. Package a release candidate with evidence; deploy only after owned-runtime and approval gates pass.

## 14. Current implementation truth

This document is an architecture and implementation specification. It does not claim that the control plane, agent registry, workflows, security controls, or production deployment described above are already implemented. Existing project deployments marked READY by a hosting provider are not proof of owned-runtime production readiness or customer acceptance. Every capability must be independently inspected and tested before it is promoted to operational status.
