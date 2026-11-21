# IZAKHONO BUILDER — Baseline Technical Audit

**Project ID:** IZK-AI-BLD-001  
**Inspection date:** 14 November 2026  
**Scope:** Read-only inspection of the connected GitHub, Vercel and Supabase assets.  
**Change impact:** No production configuration, database schema, customer data or deployments were changed during this audit.

## 1. Executive finding

IZAKHONO already has a meaningful native Builder foundation. The repository contains a native adapter, a native Builder lifecycle core, deterministic starter generation, an owner-facing Build Anything experience, an internal repository and a release-candidate flow.

The most important gap is not the absence of a product. It is the separation between these pieces and the lack of verified durable end-to-end execution. The current customer-facing Build Anything path and the autonomy native adapter are distinct code paths in the inspected source. The current generated bundle is a deterministic starter, not unrestricted full-stack application generation.

The correct strategy is to consolidate and extend the existing platform, not start another disconnected Builder project.

## 2. Source-code execution trace

### 2.1 Customer-facing Build Anything

Inspected in src/sovereign.ts:

1. POST /api/build-anything requires owner authorisation.
2. The request prompt is bounded and checked for minimum length.
3. The code deterministically infers a target, project name and allowed modules.
4. Optional IZAKHONO Super AI intent enrichment is attempted with deterministic fallback.
5. A builder_projects record is created through the secure application route.
6. A build_anything.prompt event is recorded.
7. The route invokes projectAutopilotRoute.
8. The autopilot ensures a plan exists, invokes generation, invokes generated-output validation, commits a validated bundle to the internal repository and records a release candidate.
9. The response explicitly returns public_live=false and identifies owned-runtime-deployment-verification as the next gate.

### 2.2 Current generated output

Inspected in src/secure.ts:

- The generation route calls generateBundle(project, recipe).
- The inspected generator emits a Worker starter with health/features endpoints, a generated landing page, module metadata and repository-ready files.
- The validation route applies deterministic static checks.
- The autopilot records a controlled release candidate and does not publish publicly.

This is useful as a controlled starter/template pipeline. It is not evidence of arbitrary full-stack code generation, live database-backed business workflows, general-purpose deployment or customer acceptance.

### 2.3 Native autonomy adapter

Inspected in autonomy/builder-adapter.mjs and autonomy/native-builder.mjs:

- The adapter delegates to runNativeBuilder and reports provider izakhono-native.
- Supported actions include adapter-contract, run-worker, validate-manifest, plan-only, builder-scaffold, builder-generate, builder-validate, builder-security, builder-test and builder-package.
- Website content generation uses a local-model adapter where configured, with deterministic fallback.
- The native Builder core in products/izakhono-native-builder/src/index.ts defines project and job types, legal lifecycle transitions and distinct-approver checks for sensitive/financial/destructive/external work.
- Unit tests cover ordinary lifecycle transitions and approval separation.

The inspected src/sovereign.ts Build Anything route does not directly import runBuilderAdapter or runNativeBuilder. A single authoritative execution path must be chosen and wired, or the duplication must be formally retired after proof. Do not assume the two paths are already integrated.

### 2.4 Existing durable Native Builder API

A further inspection of registry/worker-persistent.ts and products/izakhono-native-builder/src/d1-store.ts found an existing D1-backed Native Builder API on the IZAKHONO Registry Worker:

- POST /native-builder/projects registers a native Builder project.
- GET /native-builder/projects/:id retrieves a project.
- POST /native-builder/jobs creates a controlled build job through NativeBuilderCore.
- POST /native-builder/jobs/:id/approve enforces the core's distinct-approver check.
- GET /native-builder/jobs/:id retrieves a job.
- D1BuilderStore persists project and job payloads in native_builder_projects and native_builder_jobs.

This is an important existing integration asset. It means the native Builder's project/job domain and durable D1 persistence already exist behind a bearer-token-protected Registry API. The missing bridge is narrower and more actionable than initially stated: the customer-facing Build Anything path does not yet call this Registry API, and the Registry API does not expose a complete external worker claim/lease/heartbeat/recovery/result contract for the native Builder jobs.

The separate products/izakhono-native-builder/src/queue.ts contains a conditional queued-to-running claim and result evidence write, but it has no lease expiry or abandoned-running-job recovery. A worker crash after claim can therefore leave a job running without a reclaim path. Do not treat this queue as crash-resilient until leases, heartbeat, expiry recovery and concurrency tests are implemented.

## 3. Data and security observations

Supabase project inspected: IZAKHONO WebStart.

Initial row counts:
- forge_agents: 13
- forge_workspaces: 0
- forge_projects: 0
- forge_jobs: 0
- app_store_apps: 10
- app_store_app_blueprints: 31
- app_store_provisioning_jobs: 0
- izakhono_hosting_nodes: 1
- izakhono_deployment_targets: 6

The only hosting node record returned was:
- node_key: test-node-placeholder
- target_key: hosting-owned-node
- status: blocked
- endpoint: https://invalid.example
- metadata identifies it as a disabled probe.

It is not an eligible production execution target.

### 3.1 RLS policy matrix

The inspected relevant tables have Row Level Security enabled. The following tables returned zero policies in the public schema:

- forge_agents, forge_artifacts, forge_events, forge_job_steps, forge_jobs, forge_models, forge_projects, forge_workspaces
- app_build_worker_heartbeats, app_build_worker_queue, app_store_release_queue
- business_engine_provisioner_links, business_engine_provisioner_requests
- izakhono_deployment_targets, izakhono_dns_records, izakhono_dns_zones, izakhono_hosting_nodes
- izakhono_provisioning_jobs and several other IZAKHONO infrastructure/service tables.

With RLS enabled and no applicable policy, ordinary API roles are denied by default. This is not proof of public data exposure; it may be an intentional service-role-only design. Before connecting the Builder UI or workers to these tables, document the intended access model, identify service-role boundaries, inspect grants and functions, and add least-privilege tenant policies only where required. Never solve this by granting broad authenticated access.

Other App Store tables have policies for published catalogue reads and owner-scoped customer operations. Their actual predicates and relationship paths still require review before reuse as the Builder's canonical tenant security model.

No schema changes or policy changes were applied.

## 4. Deployment observations

Vercel team inspected: Bevan (team slug bevan2).

Relevant project observations:
- izakhono-website-factory latest production deployment: READY; endpoint inspection returned HTTP 200.
- izakhono-host latest production deployment: READY; endpoint inspection returned HTTP 200 and an IZAKHONO HOST control-plane landing page.
- izakhono-app-factory latest production deployment: READY.
- izakhono-forge-x20 latest production deployment: READY.
- izakhono-agentflow-prod and izakhono-model-router latest deployments: READY.

Vercel project metadata reports live=false for the inspected projects. Several have SSO protection enabled. These are successful provider deployments, not proof of public customer availability or owned production hosting. The inspected HOST landing page is not proof that a customer tenant can be provisioned and served by the owned runtime.

## 5. Repository governance observation

The connected GitHub repository bevanshelton-netizen/izakhono-builder is currently public and the connected account has administrative/push permissions.

This may be intentional for some code, but it must be an explicit IP decision. Before placing proprietary customer templates, signing material, private operational runbooks or commercially sensitive source in this repository, decide which components are public, private or customer-exportable. Run secret and sensitive-data scans; never commit credentials. Do not change repository visibility as part of this audit because that can affect integrations and deployments.

## 6. Prioritised remediation

### P0 — Authoritative execution path
- Choose the canonical Build Anything execution pipeline.
- Wire the customer-facing request to durable jobs and native execution.
- Remove duplicate progress states and ensure all status is derived from persisted job events.
- Keep public_live false until independent runtime verification.

### P0 — Durable execution
- Implement idempotency keys, worker leases, heartbeat expiry, bounded retries, dead-letter handling and safe worker recovery.
- Persist job events and immutable artifact hashes.
- Bind approval to the exact plan/artifact digest.

### P0 — Security model
- Document which services use service-role access and which use user JWT access.
- Review grants, RLS predicates, views and privileged functions.
- Add tenant-scoped policies only after the ownership model is explicit.
- Keep zero-policy tables inaccessible to ordinary API roles until approved policies exist.

### P1 — Real application vertical
- Expand the generator from a landing-page/Worker starter into a complete, testable application template with real data persistence, authentication, role checks, forms, validation and audit events.
- Build the first end-to-end customer scenario.
- Add unit, integration, browser and tenant-isolation tests.

### P1 — Runtime acceptance
- Replace the blocked placeholder node with a verified execution target only after runtime binding, public reachability, persistent storage, monitoring, DNS/TLS, backup/restore and rollback checks pass.
- Keep Vercel preview/development targets separate from owned production targets.

### P1 — IP governance
- Decide repository visibility and source classification.
- Ensure proprietary customer code and operational secrets are handled according to that decision.

## 7. Verification boundary

This audit is based on connected-account metadata, source files and read-only SQL inspection on 14 November 2026. It is not a penetration test, full code review, backup restore drill, load test, production deployment test or customer acceptance test. Findings must be rechecked before release decisions.
