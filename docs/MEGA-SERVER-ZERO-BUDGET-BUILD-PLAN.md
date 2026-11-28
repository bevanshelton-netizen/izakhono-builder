# IZAKHONO MEGA SERVER — Zero-Budget Build Plan

**Status:** Development foundation  
**Operating rule:** No spending, paid upgrades, debt, or production cutovers without explicit owner approval.  
**Primary software platform:** Linux / Ubuntu LTS  
**Architecture principle:** Owned-first, portable, externally reversible.

## 1. Objective

Build the IZAKHONO hosting and software-infrastructure platform before paying for dedicated compute. The first deliverable is a tested, portable software stack and deployment process—not a claim that a production mega-server is already running.

The physical execution environment is replaceable. NODE01 remains a logical software-node identity and must never be confused with a physical machine.

## 2. Zero-budget execution model

### Stage A — Build without a server

Use the existing personal GitHub repository as a temporary development source and a browser-based Linux development environment where available.

- Prefer GitHub Codespaces on the personal account's included free allowance.
- Current published personal Free allowance: 120 core-hours and 15 GB-month storage. A 2-core environment therefore represents up to 60 hours of runtime if compute is the limiting allowance.
- Stop idle environments, use the default Linux dev-container image, monitor usage, and do not configure paid overages.
- If the allowance is exhausted, continue with repository-based code review, documentation, tests that fit free CI allowances, and wait for the next monthly reset.
- Do not treat a temporary development container as an always-on production server.

Official references:
- https://docs.github.com/en/billing/concepts/product-billing/github-codespaces
- https://docs.github.com/en/codespaces/troubleshooting/troubleshooting-included-usage

### Stage B — Optional free Linux VM

Investigate a provider's genuinely Always Free compute only if the owner can complete identity verification without spending money or accepting charge exposure.

Oracle Cloud currently advertises Always Free Arm compute and storage allowances. Account creation normally requires a valid payment card for identity verification and may create a temporary authorization hold. Do not proceed if a usable card is unavailable, if a hold would cause hardship, or if the account requires a paid upgrade. Free capacity is not guaranteed in every region and resources remain subject to provider terms and inactivity policies.

- Keep any VM within the provider's clearly marked Always Free limits.
- Do not activate paid trial-only resources.
- Do not upgrade to Pay As You Go.
- Do not attach paid networking, backup, database, support, or marketplace services.
- Configure budgets/limits where offered, but never rely on budgets as a substitute for avoiding paid resources.
- A free-tier VM is a development/test node, not a production availability guarantee.

Official reference: https://www.oracle.com/cloud/free/

### Stage C — Portable owned-first platform

Implement and test the platform in layers so it can move from Codespaces to a free VM, then to a paid VPS or physically owned hardware later without architectural redesign.

Target components:
1. Control plane: Node.js service, typed job queue, audit trail, tenant/site/domain records.
2. Edge: Caddy reverse proxy and a portable DNS adapter; no live DNS delegation during development.
3. Runtime: isolated application containers with resource limits and non-root execution.
4. Data: PostgreSQL, Valkey, and S3-compatible object storage adapters.
5. Source: repository abstraction; GitHub remains a temporary mirror/development source until the native source layer is proven.
6. Security: FORTRESS policy gates, least-privilege identities, secret isolation, signed build artefacts, audit events.
7. Recovery: automated backup/restore tests using disposable test data before any production data is considered.
8. Mail: separate mail plane; do not expose public SMTP or promise deliverability until DNS, reputation, abuse controls, backups, and acceptance tests are complete.

## 3. Build order and acceptance gates

### Gate 0 — Repository and cost safety
- Work on a dedicated feature branch.
- Confirm the baseline commit and inspect existing scripts before changing them.
- Keep production secrets out of source control.
- No paid resource creation, DNS change, public port exposure, or production migration.

### Gate 1 — Reproducible development environment
- Provide a default Linux dev-container definition using only free/open-source tooling.
- Pin major tool versions and document supported architectures (x86_64 and ARM64 where dependencies permit).
- Add a one-command local validation workflow.
- Ensure stopping/deleting the environment does not destroy source or test evidence.

### Gate 2 — Platform preflight
- Validate OS, architecture, disk, memory, ports, container runtime, and environment variables.
- Fail closed when a resource limit or required security control is missing.
- Never execute arbitrary owner-mode shell commands from customer-controlled input.

### Gate 3 — Core service composition
- Create development-only compose profiles for control plane, edge, PostgreSQL, Valkey, and object storage.
- Bind development services to loopback by default.
- Use generated local-only secrets; never reuse them in production.
- Add health checks, resource limits, named volumes, and deterministic shutdown.

### Gate 4 — Tests and evidence
- Unit, integration, security, and smoke tests.
- Verify tenant isolation and access boundaries.
- Test backup and restore with disposable data.
- Record evidence and known limitations. A passing test suite is not proof of production readiness.

### Gate 5 — Deployment readiness
- Produce immutable build artefacts and a deployment manifest.
- Require explicit target, resource budget, secret source, health checks, backup proof, and rollback plan.
- Block production deployment until a real host is enrolled and acceptance checks pass.

## 4. Non-negotiable cost controls

- Maximum approved spend at this stage: **R0**.
- Never enter a paid upgrade flow or enable paid usage.
- Never create paid cloud resources in a free-trial account.
- Never assume a card authorization is harmless to the owner's available balance.
- No debt, loans, or commitments.
- If a provider's free allowance or billing status is unclear, do not provision.
- Record free-tier quotas, renewal dates, expiry conditions, and inactivity rules.
- If free capacity disappears, pause compute—not security, source preservation, or cost controls.

## 5. Production truth

A software definition, compose file, green unit test, or free development VM is not proof of a production service. Production status requires a real enrolled host, verified public networking, TLS, domain control, security controls, monitoring, backup and restore evidence, end-to-end acceptance, and an approved rollback plan.

Until all those conditions are met, label the platform **development**, **test**, or **staging** as appropriate.

## 6. First implementation tasks

1. Inspect the current repository's HOST, NODE, FORTRESS, and deployment implementations.
2. Reuse existing working components rather than duplicate them.
3. Add a reproducible, zero-cost Linux development environment.
4. Add preflight and cost-safety checks before any provisioning code.
5. Run the available tests and report exact results.
6. Keep all changes on this feature branch for review; do not merge or deploy automatically.

**Promise:** Build the software first. Spend nothing without permission. Preserve the owner's ability to move the entire platform.
