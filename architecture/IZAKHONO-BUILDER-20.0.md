# IZAKHONO BUILDER 20.0 — Architecture and Delivery Contract

**Project ID:** IZK-AI-BLD-001  
**Portfolio:** IZAKHONO AI / Software Engineering & Provisioning  
**Status:** Architecture baseline; implementation and production acceptance remain gated.

## 1. Product mandate

IZAKHONO BUILDER is IZAKHONO's proprietary, provider-neutral software creation and delivery platform. An authorised customer or operator describes a business or software outcome; the platform converts the intent into a controlled engineering plan, generates or modifies a project, validates it, packages it, deploys it to an approved execution target and provides verifiable handover evidence.

Hercules is not the product brand, runtime, execution provider or required dependency. The native IZAKHONO adapter is the sole built-in Builder execution provider. External provider integrations, if ever authorised, must be optional, isolated behind replaceable adapters and must not become a hidden source of truth.

The platform is intended to be commercially viable, African-first and globally usable, accessible to non-technical customers, and engineered toward an enterprise-grade 20.0 standard. This target is not a claim that every capability is complete.

## 2. Product outcomes

1. Create and maintain websites, web applications, internal tools, portals, commerce systems, APIs and workflow systems.
2. Produce a structured plan and acceptance criteria before code or infrastructure changes.
3. Reuse versioned templates, modules, design systems and industry blueprints.
4. Keep project metadata, source snapshots, build plans, evidence and release history under IZAKHONO-controlled records.
5. Support multiple AI/model providers without coupling the product to one model vendor.
6. Degrade safely when a model or provider is unavailable; never invent successful generation.
7. Provision approved applications through IZAKHONO HOST and registered execution targets.
8. Enforce tenant isolation, least privilege, approval separation, auditability and recovery.
9. Give customers understandable progress, previews, release notes, ownership and support.
10. Monetise through transparent IZAKHONO plans, without artificial AI-credit wallets or hidden per-prompt/per-build meters.

## 3. Architecture principles

- Owned-first: IZAKHONO-controlled source of truth, orchestration, policy, artifacts and preferred runtime.
- Externally reversible: model providers, Git mirrors, cloud substrates, mail and payment providers remain replaceable adapters.
- No hostage platform: no mandatory Hercules account, credits or irreplaceable vendor-specific project format.
- Evidence before claims: build, preview, deployment, DNS/TLS and customer acceptance are separately evidenced.
- Secure by default: tenant isolation, role-based access, server-side secrets, signed artifacts, audit events and fail-closed policy.
- Human approval for consequential actions: financial, destructive, external, security-sensitive and production-impacting operations require an authorised approver distinct from the requester.
- Reproducible releases: pinned dependencies, lockfiles, versioned build recipes, artifact hashes and traceable deployment manifests.
- Graceful degradation: provider outages cannot corrupt project state or falsely mark work complete.
- Accessible and localised: mobile-first, plain-language workflows, South African defaults where appropriate, international currency/timezone/language support.
- NODE01 is a logical software identity, never a physical server or execution machine. Runtime hosts are separately identified and verified.

## 4. Logical architecture

### 4.1 Experience plane — Builder Studio

Natural-language Build Anything intake; requirements clarification; project dashboard; plan and change review; source and preview views; release history; template/blueprint catalogue; customer workspaces; team roles; billing plan and transparent usage.

### 4.2 Control plane — Builder Orchestrator

Project registry and source-of-truth resolver; requirements normaliser; architecture planner; dependency resolver; durable job queue; scheduler; worker leases; bounded retries; dead-letter handling; approval service; policy decision point; artifact registry; release manager; deployment coordinator; rollback controller; audit and telemetry.

### 4.3 Engineering plane — AI Engineering Workforce

Role-specialised agents: product analyst, solution architect, UX/UI designer, frontend engineer, backend engineer, data engineer, QA engineer, security engineer, DevOps/release engineer and independent reviewer.

Agents operate with scoped permissions and bounded tasks. They are not root administrators. Every tool call is authorised, logged and checked against the job's permission and approval state.

### 4.4 Execution plane — Native Builder

Deterministic native adapter; project scaffolding; versioned template renderer; controlled source patching; code-generation pipeline; sandboxed build/test workers; private-network local-model adapter; provider-neutral model interface; static analysis; type checks; dependency and secret scanning; artifact packaging; checksums and provenance.

The current native adapter includes deterministic planning, scaffolding, website-content generation, validation, security and packaging actions. It must not be represented as complete arbitrary code generation or general-purpose application deployment until those capabilities pass their own acceptance suites.

### 4.5 Runtime plane — IZAKHONO HOST

Tenant/site control plane; edge routing; DNS authority; TLS; isolated tenant runtimes; durable database; object storage; queue/cache services; backups; restore drills; observability; incident response; and replaceable mail/payment adapters.

Vercel may remain a development, preview or temporary deployment substrate during transition. It is not to be described as the owned production runtime. Production activation requires verified public reachability, DNS delegation, trusted HTTPS, backup/restore evidence, security review and end-to-end customer acceptance.

### 4.6 Security plane — FORTRESS

Authentication and session controls; tenant-scoped authorisation; role/permission policies; secret storage and rotation; build sandbox and egress restrictions; input validation and output encoding; dependency/SBOM and vulnerability checks; rate limiting; abuse detection; audit trail; approval separation; backup integrity and incident response.

## 5. Canonical build lifecycle

Every build follows a durable state machine:

requested → requirements → planned → awaiting_approval (when required) → queued → running → testing → security_review → packaging → release_candidate → deploying → verifying → accepted.

Terminal states: succeeded, failed, cancelled and rolled_back.

Rules:
- Every transition is validated by the control plane and persisted transactionally.
- Jobs use idempotency keys and bounded retries.
- Worker leases expire safely; abandoned jobs can be reclaimed without duplicate side effects.
- Failures record a machine-readable reason, logs and recovery guidance.
- Approval is bound to the exact plan/artifact digest; material changes invalidate prior approval.
- Deployment is impossible without a passed security gate and eligible target.
- succeeded means the requested build and required tests passed; it does not mean public-live.
- public_live requires a separate deployment evidence record and external verification.
- Customer acceptance is a distinct event, not inferred from deployment success.

## 6. Canonical domain entities

The target model includes tenants, tenant_members, roles, permissions, projects, project_sources, project_versions, project_dependencies, requirements, acceptance_criteria, architecture_decisions, build_jobs, build_job_steps, worker_leases, job_events, approvals, policy_decisions, audit_events, artifacts, artifact_files, artifact_attestations, SBOM records, templates, blueprints, modules, module_versions, environments, execution_targets, runtime_bindings, deployments, deployment_checks, rollback_events, provider_adapters, model_routes, provider_health, subscriptions, entitlements, invoices, payment_events, support_cases, customer_acceptance and service_incidents.

Existing tables and products must be inventoried and mapped before schema duplication or destructive migration. In particular, existing forge_*, app_store_*, izakhono_*hosting* and *provisioner* tables must be reconciled into a documented canonical model. Preserve customer and product data.

## 7. Security and governance acceptance

- RLS enabled on every exposed tenant-data table.
- Every tenant read/write policy includes an explicit tenant membership or ownership predicate; authenticated role alone is insufficient.
- No service-role or provider secret in browser bundles, logs or repository history.
- External callbacks/webhooks are authenticated, replay-resistant and idempotent.
- Build workers have isolated workspaces, bounded CPU/memory/time, restricted filesystem access and default-deny network egress.
- Generated HTML is escaped/sanitised; generated code is not executed in the control-plane process.
- Dependency lockfiles and provenance are retained per release.
- Production credentials are separated by environment and least privilege.
- Approval records identify requester, approver, exact change digest, scope and timestamp.
- Privileged audit records are append-only.
- Backup restore is tested, not merely configured.
- Threat model and security review are updated for material architecture changes.

## 8. Reliability and service objectives

Initial engineering targets, to be validated before becoming contractual SLAs:

- Control-plane API availability target: 99.9% monthly.
- An acknowledged durable job must not silently disappear.
- Queue processing must recover idempotently after worker restart.
- Every release maps to immutable source and artifact digests.
- RPO/RTO are documented per service tier and tested in restore drills.
- Logs, metrics and traces correlate by tenant, project, job and deployment IDs.
- WCAG 2.2 AA is the customer-facing accessibility target.
- Performance budgets are mobile-first and tested on constrained devices and networks.

## 9. Delivery workstreams

### W0 — Baseline and source-of-truth audit
Inventory repositories, deployed projects, schemas, policies, triggers, workers, artifacts, secret references, domains and runtime bindings. Produce a dependency graph and duplicate/conflict register. Never expose secret values in reports.

### W1 — Canonical product and control plane
Define canonical project/job/tenant/release contracts. Reconcile existing Forge and App Store schemas. Add durable job events, leases, idempotency and transition enforcement only after migration design and backup.

### W2 — Builder Studio
Unify Build Anything intake, project workspace, plan review, file/change diff, test evidence, preview and release controls. Do not create a second disconnected Builder UI.

### W3 — Native engineering execution
Expand from website-content artifacts to controlled code generation and modification, multi-template scaffolding, isolated worker execution, test orchestration and repair loops.

### W4 — Quality and FORTRESS gates
Automate type checks, unit/integration/E2E tests, accessibility, dependency, secret, static security and policy checks. Bind approvals to artifact digests.

### W5 — IZAKHONO HOST integration
Register and verify eligible runtime targets. Build deployment, DNS, TLS, backups, monitoring and rollback integration. Keep external preview targets separate from owned production.

### W6 — Customer lifecycle and monetisation
Tenant onboarding, plan entitlements, transparent pricing, payment reconciliation, domain onboarding, customer handover, support and renewal workflows. Preserve iKhokha as preferred payment route where configured and authorised.

### W7 — Launch certification
Independent security review, performance/load tests, disaster-recovery exercise, customer acceptance, public endpoint verification and operational runbooks.

## 10. Definition of done — 20.0

A release is not complete until all applicable gates pass:

1. Requirements and acceptance criteria approved.
2. Architecture and data-impact review complete.
3. Source changes reviewed and reproducible.
4. Automated tests pass with retained evidence.
5. Security, dependency and secret scans pass.
6. Tenant isolation and authorisation tests pass.
7. Build artifact is immutable, hashed and traceable.
8. Approval requirements are satisfied.
9. Deployment target health and capacity are verified.
10. DNS/TLS/public route is verified when public release is intended.
11. Backup and rollback path is proven for stateful changes.
12. Monitoring and incident ownership are assigned.
13. Customer workflow is tested on mobile and desktop.
14. Customer acceptance is recorded where applicable.
15. Release notes and operator/customer handover are prepared.

A green CI status or Vercel READY state alone does not satisfy this definition.

## 11. Verified baseline and open gaps

The connected-account audit found:

- GitHub repository bevanshelton-netizen/izakhono-builder exists and is writable by the connected account.
- The main README already defines the native IZAKHONO Builder as the Hercules replacement and establishes owned-first principles.
- autonomy/builder-adapter.mjs delegates to runNativeBuilder and identifies the provider as izakhono-native.
- Native Builder core tests cover job transitions and separation of duties for approvals.
- Website Factory's latest Vercel production deployment reported READY; its inspected endpoint returned HTTP 200.
- Vercel project metadata still reports live=false; several projects have SSO protection. A successful deployment is not proof of public availability.
- IZAKHONO HOST endpoint returned HTTP 200 and displayed its control-plane landing page. This is not proof of a production tenant runtime or owned public hosting.
- Supabase IZAKHONO WebStart contains existing Forge, App Store, hosting and provisioning tables.
- Initial counts included 13 Forge agents, 10 App Store apps, 31 blueprints, zero Forge workspaces/projects/jobs, zero App Store provisioning jobs, one disabled placeholder hosting node and six deployment targets.
- The disabled placeholder node is not eligible for production promotion.
- Deterministic website generation is not equivalent to unrestricted full-stack code generation.

These are point-in-time observations. Re-run checks before production decisions.

## 12. Immediate execution sequence

1. Inspect the full repository, branch protection and current CI/test workflows.
2. Map current Builder UI/API routes to the native adapter and identify the real execution entry point.
3. Audit relevant Supabase tables, RLS policies, triggers and data; produce a migration plan without applying DDL.
4. Verify native Builder tests and security gates in reproducible CI.
5. Implement missing durable queue/lease/idempotency behaviour on a dedicated branch.
6. Connect Builder UI to durable jobs and evidence, not mock progress.
7. Implement one complete small application template as the first end-to-end acceptance vertical.
8. Run isolated build, test, artifact, preview, deployment and rollback tests.
9. Only then promote an approved target and begin staged customer migration.

## 13. Change control

This document is an architecture and delivery contract. It does not assert that future capabilities are already implemented. Production claims must cite current runtime evidence. No existing Vercel project, Supabase table, repository, domain, customer artifact or external service may be deleted, disconnected or migrated without a separately reviewed change plan and recovery path.
