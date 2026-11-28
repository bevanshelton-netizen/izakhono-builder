# IZAKHONO DEPLOY implementation roadmap

## Phase 0 — reuse and verify foundations
- Inventory NODE01-SW, IZAKHONO CONTROL, registry, EDGE, build scripts, provisioner and existing CI.
- Preserve the NODE01 software-runtime identity policy.
- Identify existing persistent stores and avoid duplicate registries or ledgers.
- Add architecture and security gates.

## Phase 1 — read-only control plane
- Application, environment, target and release registry views.
- Deployment history and immutable artifact metadata.
- Health/readiness observations and append-only audit events.
- No production mutation endpoints yet.

## Phase 2 — safe build pipeline
- Git source discovery and commit pinning.
- Docker/BuildKit-compatible build adapter.
- Tests, dependency/security scans, SBOM and image digest capture.
- Artifact registry adapter; no credentials in browser or build args.

## Phase 3 — NODE01-SW execution adapter
- Authenticated node registration and capability discovery.
- Workspace-isolated deployment jobs and resource limits.
- Health/readiness checks and evidence-backed state transitions.
- No arbitrary shell execution; explicit allowlisted runtime operations only.

## Phase 4 — promotion and rollback
- Staging first, production approval gate, immutable release promotion.
- Health-gated rollout, rollback to last known-good digest.
- Idempotent commands, concurrency locks and audit attribution.

## Phase 5 — operations
- Structured logs, metrics, events, alerts, backup/restore tests, domain/TLS observations.
- Optional external Docker target as a replaceable fallback adapter.

## Acceptance gates
- Unit/integration tests pass in CI.
- Security and NODE01 identity checks pass.
- Runtime adapter tested against an approved execution environment.
- Backup/restore and rollback demonstrated.
- Public HTTPS independently verified before any live claim.

No stage may be marked complete from documentation or a mocked dashboard alone.
