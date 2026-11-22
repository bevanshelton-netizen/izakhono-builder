# IZAKHONO Vercel-to-Owned-Infrastructure Cutover Runbook

**Status:** APPROVED ARCHITECTURE; EXECUTION BLOCKED PENDING HOST AUTHORIZATION  
**Scope:** Repository-connected IZAKHONO applications and the production delivery path  
**Target:** IZAKHONO-owned HOST / NODE01-SW / Runtime Fabric / IZAKHONO EDGE  
**Non-goal:** This runbook does not authorize host activation, deployment, DNS changes, project deletion, or credential rotation.

## Decision

Vercel is not part of the required IZAKHONO production runtime or deployment path. Production workloads are to be built as immutable artifacts and run on IZAKHONO-controlled infrastructure. GitHub may remain the source-control and CI system; GitHub-hosted runners are not production hosts.

NODE01 remains a logical software-runtime identity. The physical or virtual execution host must be independently identified, approved, bound to NODE01, and evidenced. Do not infer a host locator from a hostname, repository file, old inventory, or CI result.

## Current verified boundary

The repository already contains:
- The accepted architecture decision `docs/architecture/IZK-ADR-0007-VERCEL-NOT-REQUIRED.md`.
- The owned runtime host preflight and activation gates under `infra/runtime/`.
- The shared NODE01 runner setup guidance under `infra/node01/GITHUB-RUNNER-SETUP.md`.
- The provider-neutral DEPLOY lifecycle policy and read-only NODE01 target adapter under `deploy-control/`.

These files do not prove that an approved HOST session, runner registration, runtime binding, or production deployment currently exists.

## Cutover sequence

### Gate 0 — Inventory and ownership

For each application currently connected to Vercel, record:
- Repository, project name, production branch and root directory.
- Production and preview domains, redirects, headers and routing rules.
- Build/install commands, runtime settings and framework configuration.
- Environment-variable names and target environments (never copy secret values into Git or this runbook).
- Functions, cron jobs, storage, caches, webhooks and external integrations.
- Current production release identity, data stores, backup owner and rollback procedure.

Keep a per-application migration ledger. Do not bulk-delete Vercel configuration or assume all projects have the same runtime contract.

### Gate 1 — Prove the owned target

Before any production change:
1. Obtain an authenticated, approved HOST operator session and verify the host identity and permissions.
2. Verify the separately declared runtime-host binding for logical NODE01.
3. Complete host preflight, container runtime, persistent storage, monitoring, backup and restore checks.
4. Register a narrowly scoped runner only after host authorization. Keep it private, least-privileged and isolated from untrusted pull-request execution.
5. Verify IZAKHONO EDGE ingress, TLS certificate management, routing, health endpoints and external HTTPS probes.
6. Confirm the authoritative database, migration owner, secret references and application-specific dependencies.

Do not run `autonomy/NODE01-BOOTSTRAP.sh`, `infra/runtime/bootstrap-runtime-host.sh`, activation scripts or deployment workflows merely to test access. A verified authorization and approved change window are prerequisites.

### Gate 2 — Build and stage

1. Pin the full source commit SHA.
2. Build in a controlled pipeline and capture an immutable OCI image digest.
3. Run tests, dependency and image security scans, SBOM generation and policy validation.
4. Publish the image to the owner-controlled registry.
5. Deploy to an isolated staging environment through an approved, allowlisted runtime adapter.
6. Verify application health, data access, email/webhooks, background jobs, observability, backups and independent HTTPS.
7. Demonstrate rollback to the last known-good immutable digest.

A Git SHA, successful CI run, container start, or mocked dashboard is not production acceptance evidence.

### Gate 3 — Production cutover

For each application independently:
1. Obtain explicit human approval tied to the exact tested artifact digest and change record.
2. Verify production backup freshness and restore readiness.
3. Deploy and health-check the owner-hosted release without changing public DNS.
4. Validate the target using the production hostname through a controlled pre-cutover route where possible.
5. Confirm TLS, external HTTPS, application acceptance and rollback readiness.
6. Change DNS only under the approved change plan, with the DNS zone owner and rollback values recorded.
7. Observe the new route and retain verifiable runtime, HTTPS and acceptance evidence.

Do not cut over a domain while the owner-hosted target is unverified. Do not claim LIVE until all required evidence is independently checked.

### Gate 4 — Remove Vercel from the delivery path

After the owner-hosted production route is stable and accepted for the application:
1. In Vercel Project Settings → Git, disconnect that project from the Git repository, or remove the repository from the Vercel GitHub App's repository access if the approved scope is all linked projects.
2. Confirm new commits and pull requests no longer trigger Vercel builds for the migrated project.
3. Remove obsolete Vercel deployment checks from required GitHub branch protection only after confirming the owner-hosted CI and release checks are required and passing.
4. Remove obsolete Vercel-specific workflow/configuration only after repository-wide reference and application inventory.
5. Keep historical project records and deployment evidence during the agreed retention period. Project/account deletion is a separate, explicitly approved action.

Do not disconnect every project at once. Migrate and verify one application at a time so unmigrated workloads are not taken offline.

## Prohibited shortcuts

- No disabling Vercel Git integration before the replacement workload and route are accepted.
- No DNS cutover, domain removal, project deletion or account closure as part of a blind bulk migration.
- No secrets in source, workflow logs, build arguments or deployment evidence.
- No arbitrary SSH target, disabled SSH host-key verification, unrestricted shell runner or public runner listener.
- No production deployment from an untrusted pull-request context.
- No claim that HOST/NODE01 is authorized, healthy, deployed or LIVE without evidence from the actual owner environment.

## Current release gate

The DEPLOY control-plane PR remains a foundation, not a completed hosting migration. Its lifecycle module and target adapter do not yet provide the authenticated API, durable single-transaction tenant-scoped persistence/idempotency/audit, verified runtime binding, or approved HOST execution session required for production.

**Current decision: Vercel is excluded from the target production architecture. Actual cutover remains HOLD until the HOST/NODE01 authorization and owner-runtime acceptance gates are satisfied.**
