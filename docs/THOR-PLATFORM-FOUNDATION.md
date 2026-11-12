# THOR by IZAKHONO — Platform Foundation

**Product:** THOR  
**Owner:** IZAKHONO AFRICA (Pty) Ltd  
**Purpose:** Build and operate an IZAKHONO-owned AI software factory that can create, test, improve and deploy the IZAKHONO portfolio and customer applications.

## 1. Product mandate

THOR is not a wrapper around Hercules and must not depend on Hercules credits, proprietary builder APIs, or a single model vendor. Hercules is a reference competitor only. THOR must be an independently owned product with replaceable model, compute, storage, database and deployment adapters.

The first customer is IZAKHONO itself: THOR must help build and maintain all active IZAKHONO platforms in parallel. The second customer is external businesses that need websites, applications, portals, commerce systems and workflow automation.

## 2. Product promise

A user describes a business outcome in natural language. THOR turns that request into a reviewable specification, decomposes it into tasks, assigns specialist workers, generates and edits code, runs checks in isolated workspaces, integrates approved changes, and prepares a release with evidence.

THOR must never claim a feature is complete, deployed or live without test and deployment evidence.

## 3. Core product modules

1. **THOR COMMAND** — portfolio dashboard, project registry, activity, approvals and command interface.
2. **THOR ORCHESTRATOR** — task graph, dependencies, priorities, worker assignment, retries, handoffs and concurrency controls.
3. **THOR AGENTS** — specialist workers for product analysis, architecture, frontend, backend, data, integrations, QA, security, DevOps, documentation and commercial readiness.
4. **THOR BUILDER** — natural-language-to-application workflow, code generation, repository-aware edits and reusable project templates.
5. **THOR WORKSPACE** — isolated, ephemeral build environments with resource quotas, scoped credentials and audit trails.
6. **THOR CONNECT** — provider-neutral connectors for Git repositories, databases, APIs, payment providers, domains, email and messaging.
7. **THOR TEST** — unit, integration, type, security, accessibility and end-to-end test orchestration.
8. **THOR DEPLOY** — owned-first release pipeline, preview environments, health checks, rollback and deployment evidence.
9. **THOR MEMORY** — project specifications, architecture decisions, approved patterns, repository maps and task history with tenant boundaries.
10. **THOR GOVERN** — human approvals for production releases, destructive operations, paid resources, secrets and legally/financially consequential actions.
11. **THOR METER** — cost, token, compute, storage and project usage controls; hard budget limits and transparent estimates.
12. **THOR MARKET** — customer onboarding, plans, usage metering, billing integration and reusable delivery packages.

## 4. Parallel execution model

- One portfolio-wide backlog and dependency graph.
- Projects and tasks are independently schedulable; one blocked project never idles unrelated workers.
- Workers claim bounded tasks with explicit repository, branch, file scope and acceptance criteria.
- Concurrent edits to the same files must be prevented or serialized.
- Every task records status, worker, inputs, outputs, logs, tests, commit/PR and blocker.
- Workers can cross-review and help other projects.
- The scheduler prioritizes customer impact, revenue, risk reduction and critical-path dependencies.
- Queue fairness prevents one project from starving all others.
- A failed worker is retried or its task is handed off; failures do not silently disappear.

## 5. Standard job lifecycle

`REQUESTED → CLARIFY → SPECIFIED → PLANNED → QUEUED → BUILDING → TESTING → REVIEW → APPROVAL → RELEASED`

Alternative terminal states: `BLOCKED`, `CANCELLED`, `FAILED`, `ROLLED_BACK`.

Every transition must be durable, timestamped and auditable. A job must be resumable after worker or host restart.

## 6. Reference architecture

- **Control plane:** API, identity, project registry, task scheduler, policy engine and audit log.
- **Orchestration plane:** durable queue, dependency graph, worker leases, retries and event bus.
- **Worker plane:** isolated containers or equivalent sandboxes; no unrestricted host access.
- **Model gateway:** provider-neutral routing across permitted hosted models and local models; capability, latency, cost and policy-aware selection.
- **Tool gateway:** allow-listed tools with scoped credentials, per-action policy checks and complete audit records.
- **Data plane:** relational metadata store, object/artifact storage, vector/search index where justified, and encrypted secrets management.
- **Delivery plane:** Git branches/PRs, CI, preview environments, owned-first runtime deployment, health checks and rollback.
- **Observability:** structured logs, traces, metrics, worker heartbeats, cost attribution and failure alerts.

Use existing IZAKHONO components where they are verified and fit the boundaries. In particular, audit and integrate the existing native-builder, AI-runtime, autonomy, registry/queue, website-factory, Provisioner and NODE01 work before creating overlapping systems. This document does not declare those components production-ready.

## 7. Security and trust requirements

- Tenant and project isolation across data, artifacts, memory and credentials.
- Secrets never enter prompts, logs, generated source or client bundles.
- Short-lived, scoped credentials; no blanket production credentials for workers.
- Sandboxed code execution with network egress allow-lists, CPU/memory/time quotas and filesystem boundaries.
- Dependency and generated-code scanning before integration.
- Human approval for production deployment, destructive migrations, domain/DNS cutovers, payments, paid infrastructure and external communications with legal/financial consequences.
- Signed artifact provenance and immutable audit events.
- Prompt-injection and untrusted-repository-content defenses.
- Backups, recovery tests, incident controls and tenant data export/deletion policies.

## 8. Owned-first infrastructure

Prefer IZAKHONO-controlled compute, storage, database, networking and deployment. Keep adapters replaceable and maintain verified external fallbacks. Do not introduce Vercel into new core THOR hosting/provisioning paths. Do not cut over existing customer workloads until replacement health, data integrity, rollback and acceptance are proven.

NODE01 is the intended orchestration identity, but physical host activation is a separate dependency. THOR product design, repository implementation, tests, adapters and documentation must continue without waiting for physical host activation.

## 9. MVP acceptance sequence

### MVP-0 — Inventory and integration map
- Map current native-builder, AI-runtime, autonomy, replica-engine, registry, queue, website-factory, Provisioner and NODE01 code.
- Identify working paths, duplicated responsibilities, failing tests, external dependencies and missing interfaces.
- Publish an architecture decision record and implementation backlog.

### MVP-1 — Durable THOR control plane
- Project and task APIs; durable task state; dependency graph; queue; worker lease/heartbeat; retries; audit log.
- Portfolio dashboard showing every active project and real task status.
- Contract tests for state transitions, duplicate delivery, worker loss and concurrent claims.

### MVP-2 — First controlled worker
- One isolated coding worker can inspect an authorized repository, propose a bounded change on a dedicated branch, run configured tests and produce a reviewable pull request.
- No direct production deployment.
- Demonstrate a failed job, retry, handoff and successful completion with evidence.

### MVP-3 — Parallel specialist workers
- At least three different worker roles can operate on separate projects simultaneously.
- Conflict prevention, scheduling fairness, cross-review and cost ceilings demonstrated.
- A blocked worker does not block unrelated work.

### MVP-4 — Application factory
- Brief-to-specification, architecture, scaffold, implementation, test report, preview and approval.
- Reusable web application templates and safe integrations.
- Demonstrate a complete internal IZAKHONO application workflow.

### MVP-5 — Owned release and customer delivery
- Approved release to an IZAKHONO-controlled runtime, health verification, rollback and customer handover.
- Billing and usage metering only after secure entitlement and payment verification.

## 10. First implementation priorities

1. Inspect current repository code and map reusable components; do not duplicate existing engines.
2. Define THOR domain contracts: Project, Task, Dependency, Worker, Run, Artifact, Approval, Provider, Environment and Release.
3. Define durable scheduler and queue semantics, including leases, idempotency, retry limits and dead-letter handling.
4. Implement worker adapter interface and first sandboxed repository worker.
5. Add observable portfolio command surface and evidence-backed statuses.
6. Add parallel worker contract tests and security gates.
7. Connect model and deployment providers through replaceable adapters.
8. Deliver the first verified internal build from brief to pull request.

## 11. Non-goals and constraints

- Do not clone Hercules branding, UI assets, proprietary source, private APIs or protected workflows.
- Do not build an unrestricted autonomous agent with production access.
- Do not promise unlimited or zero-cost AI compute; model and infrastructure usage must be budgeted.
- Do not create paid resources, domains, subscriptions or irreversible changes without required approval.
- Do not call a design, plan, prototype or untested branch a working production builder.

## 12. Definition of success

THOR is successful when IZAKHONO can submit independent work across its portfolio and see multiple workers making measurable, non-conflicting progress at the same time; each change is testable, reviewable, secure, cost-attributed and deployable to owned infrastructure without dependence on Hercules.
