# CONNECTA Runtime Fabric Deployment Contract

Status: SOFTWARE_PACKAGED / RUNTIME_TARGET_REQUIRED

## Purpose

Define the portable boundary between CONNECTA and an operator-controlled production runtime. CONNECTA must be deployable to a newly provisioned approved host without assuming that NODE01 exists and without coupling production authority to a particular infrastructure provider.

## Authority

- IZAKHONO remains the application and control-plane owner.
- The production host is an execution target, not the source of truth.
- Provider APIs are replaceable adapters.
- Git commit SHA is immutable deployment identity.
- A successful host preflight authorizes a deployment rehearsal only.
- Public production requires the existing CONNECTA readiness gates and independent HTTPS verification.

## Deployment sequence

1. Provision an approved runtime target through the applicable Runtime Fabric provider adapter.
2. Run `products/izakhono-social/ops/production-host-preflight.sh` on that target.
3. Resolve an immutable CONNECTA commit SHA from the approved repository.
4. Supply secrets through the target's protected environment/secret mechanism; never commit them.
5. Render and validate `products/izakhono-social/docker-compose.owned.yml`.
6. Deploy PostgreSQL, CONNECTA Engine and CONNECTA Web using the owned Compose stack.
7. Run local health and application smoke tests.
8. Run backup/restore and rollback evidence procedures.
9. Configure reviewed EDGE/TLS routing.
10. Run independent HTTPS verification.
11. Promote only when every required readiness gate is PASS.

## Provider neutrality

The deployment contract intentionally does not name Contabo, AWS, Azure, Google Cloud, Vercel, or any other provider as CONNECTA's production authority. A provider adapter may create or configure compute, storage, networking and bootstrap state, but it must return verifiable evidence and remain replaceable.

## Required evidence

A production target must provide evidence for:

- host preflight
- CONNECTA local health and persistence
- backup and restore
- rollback/failback
- security and protected ports
- EDGE/TLS
- independent external HTTPS

Evidence is time-bounded and fail-closed. CI, GitHub, topology files, local development, or provider API responses alone do not prove production readiness.

## Forbidden claims

Do not claim:

- NODE01 exists unless a physical or provisioned NODE01 is independently evidenced.
- a provider server is live without deployment evidence.
- DNS or TLS is active without external verification.
- CONNECTA is public because a build succeeded.
- an enquiry is a sale.
- a partner relationship exists without an agreement.

## Target states

`SOFTWARE_PACKAGED` → `RUNTIME_TARGET_REQUIRED` → `HOST_PREFLIGHT_PASS` → `DEPLOYMENT_REHEARSAL_PASS` → `PRODUCTION_GATES_PASS` → `PUBLIC_VERIFIED`

The repository may remain at `RUNTIME_TARGET_REQUIRED` until an actual operator-controlled runtime target is supplied. That is a valid state, not a failure of the CONNECTA software package.
