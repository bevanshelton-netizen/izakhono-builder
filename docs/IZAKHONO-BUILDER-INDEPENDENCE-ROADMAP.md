# IZAKHONO BUILDER — INDEPENDENCE ROADMAP

Status: architecture and migration directive committed. Implementation milestones must be verified individually.
Owner: IZAKHONO AFRICA (PTY) LTD
Canonical repository: bevanshelton-netizen/izakhono-builder
Principle: OWN THE BUILDER. OWN THE SOURCE. OWN THE RUNTIME. OWN THE CUSTOMER RELATIONSHIP.

## Decision

IZAKHONO will replace dependency on Hercules and other hosted app-building platforms with its own application creation, editing, orchestration, testing, publishing, and lifecycle platform. Do not create a competing builder product. Extend the existing IZAKHONO BUILDER repository and control plane.

External builders may be temporary migration bridges only. They must not remain mandatory dependencies for creating, modifying, deploying, or maintaining IZAKHONO applications.

## Product definition

IZAKHONO BUILDER is the owner-operated software factory for the entire ecosystem. A user describes an application or change in natural language. The system converts the request into a plan, obtains approval for sensitive operations, generates or modifies source code, runs tests and security gates, creates a release candidate, deploys to IZAKHONO-owned runtime, verifies the deployment, and reports evidence.

## Required owned capabilities

1. Natural-language project intake and clarification.
2. Product/application registry with owner, purpose, repository, environments, domains, status, dependencies, and release history.
3. Reusable templates, design systems, components, service modules, and build recipes.
4. Source generation and controlled file editing in isolated workspaces.
5. Agent orchestration with explicit task plans, bounded tools, timeouts, retries, cancellation, and audit.
6. Preview environments and live build logs.
7. Automated unit, integration, browser, accessibility, security, and dependency tests.
8. Secrets management; secrets never enter prompts, source control, client bundles, or logs.
9. Release approvals, rollback, immutable release manifests, and deployment provenance.
10. Owned hosting, database, object storage, DNS, TLS, mail, monitoring, backups, and disaster recovery adapters.
11. Customer workspaces, permissions, usage visibility, support, billing, and predictable flat-rate plans.
12. Export/import of source, data, assets, and configuration so customers are not locked in.

## Architecture

Owner UI / voice / text
-> IZAKHONO AI conversation and identity
-> Builder API and project registry
-> planner and policy gate
-> isolated build workers
-> source workspace and internal repository
-> validation and security gates
-> immutable release candidate
-> deployment orchestrator
-> IZAKHONO HOST / owned nodes
-> health checks, telemetry, audit, rollback.

The existing repository documents the owned-first control plane and native runtime baseline: CoreDNS, Caddy, PostgreSQL, MinIO, Valkey, and containerised services. Reuse and harden those components; do not duplicate them.

## Independence rules

- No mandatory Hercules account, credits, proprietary workflow API, or hosted builder runtime.
- No mandatory Google, Microsoft, AWS, Vercel, Cloudflare, Netlify, or other single-vendor control plane for core operation.
- External AI models, speech engines, source mirrors, DNS registrars, and cloud capacity may be optional adapters, never the source of truth.
- Preserve standards-based portability: Git, OCI containers, OpenAPI, SQL, S3-compatible object interfaces, standard archives and common document formats where appropriate.
- Keep provider adapters replaceable and maintain an exportable internal source-of-truth.
- Never claim an application is deployed, production-ready, or independent until tested against the actual owned runtime and external dependency shutdown scenarios.

## Safe autonomy

The system may autonomously inspect, plan, scaffold, edit, test, and prepare release candidates within an explicitly granted project scope. Require owner approval before production releases, destructive changes, domain/DNS cutovers, financial commitments, external communications, access-policy changes, or handling regulated/sensitive data. Every action must be attributable, logged, reviewable, and reversible where technically possible.

## Migration from hosted builders

1. Inventory every existing app, source repository, data store, domain, integration, environment variable, user flow, and external builder dependency.
2. Identify canonical source and ownership for each app; never infer source from a deployment URL.
3. Export source, assets, schema, migrations, configuration, and user data using supported export mechanisms.
4. Import into the IZAKHONO internal repository and verify hashes, history, build reproducibility, and licence/IP provenance.
5. Rebuild missing builder-specific functions as IZAKHONO-native modules.
6. Run parity tests against the existing app before switching traffic.
7. Deploy to owned infrastructure, verify TLS, backups, restore, monitoring, and rollback.
8. Cut over one application at a time. Keep a documented reversible fallback until acceptance.
9. Cancel external builder subscriptions only after all dependent applications and workflows are verified independent.

## Delivery sequence

### Stage A — Inventory and control plane
Build a complete app registry and dependency inventory. Add project lifecycle states: discovered, imported, editable, validated, release_candidate, deployed_owned, verified_owned, and retired. Show source-of-truth and external dependencies for every app.

### Stage B — Native builder workbench
Provide browser IDE/workspace, file tree, source editor, visual preview, terminal/task output, template gallery, project settings, environment separation, and collaborative review. Use isolated worker execution with strict resource and network policies.

### Stage C — Build agent and workflow engine
Implement plan -> approve -> execute -> test -> package -> deploy -> verify. Persist jobs, events, logs, retries, approvals, and outputs. Add deterministic cancellation and resumability.

### Stage D — Owned deployment and operations
Integrate IZAKHONO HOST and owned runtime. Add release manifests, health checks, observability, backup/restore, rollbacks, domain/DNS/TLS management, and disaster recovery evidence.

### Stage E — Migration and retirement
Migrate all viable apps from external builders individually. Remove hosted builder dependencies only after parity and owned-runtime acceptance tests pass.

## Acceptance gates

- A new full-stack application can be created from a natural-language brief without Hercules.
- An existing application can be edited without Hercules.
- Source, assets, database schema and build history are exportable and stored under IZAKHONO control.
- Jobs survive worker restart and can be resumed or safely cancelled.
- Build workers are isolated and cannot access production secrets unless explicitly authorised.
- Tests and security checks run before release.
- Production deployment and rollback work on IZAKHONO-owned infrastructure.
- The platform continues to operate when external builder APIs are unavailable.
- At least one representative existing application is migrated end-to-end and independently verified before broad migration.
- No false production-readiness claims; evidence is attached to every release.

## Current truth

The repository already describes an application factory, reusable build recipes, internal source snapshots, a provisioning control plane, and an owned-first runtime baseline. This roadmap does not assert that a complete visual IDE, autonomous builder, or independent production hosting fleet is already finished. Each capability must be implemented, tested, and evidenced before it is marked complete.
