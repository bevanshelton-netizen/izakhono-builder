# CONNECTA Production Release Contract

## Release identity

- Product: CONNECTA by IZAKHONO
- Web package: `products/izakhono-social`
- Engine: CONNECTA discovery engine 0.3.0
- Source of truth: `main` at an immutable 40-character Git SHA
- Runtime target: operator-controlled IZAKHONO Runtime Fabric
- Preferred owner target: NODE01 when physically activated and verified

## Release states

1. `SOFTWARE_PACKAGED` — source, web package, engine, compose assets and verification gates exist.
2. `RUNTIME_TARGET_REQUIRED` — a physical/operator-controlled runtime target has not yet been proven.
3. `HOST_PREFLIGHT_PASS` — the target host passes the documented preflight.
4. `DEPLOYMENT_REHEARSAL_PASS` — the exact immutable release can boot and pass local health checks.
5. `PRODUCTION_GATES_PASS` — physical cluster, failover, backup/restore, security, EDGE/TLS and external HTTPS evidence all pass.
6. `PUBLIC_VERIFIED` — external HTTPS is independently verified against the promoted immutable release.

## Non-negotiable release rules

- Never call CONNECTA live, public, commercial GA, or production verified from CI alone.
- Never treat Vercel availability or deployment status as proof of production readiness.
- Never substitute repository files, CI output, topology declarations, or inferred hardware for physical runtime evidence.
- Never expose PostgreSQL or administrative control ports publicly.
- Production promotion requires the existing IZAKHONO production deployment gate and all seven evidence classes.
- Every production release must be rollback-capable and tied to an immutable Git SHA.

## Current gate

The software release is packaged and CI-verifiable. The remaining promotion dependency is an operator-controlled runtime target and its physical/runtime evidence. Until those gates pass, the truthful public status remains **NOT YET VERIFIED**.

## Activation sequence

```text
SOFTWARE_PACKAGED
  -> RUNTIME_TARGET_REQUIRED
  -> HOST_PREFLIGHT_PASS
  -> DEPLOYMENT_REHEARSAL_PASS
  -> PRODUCTION_GATES_PASS
  -> PUBLIC_VERIFIED
```

See `products/izakhono-node/CONNECTA-RUNTIME-FABRIC-ACTIVATION.md`, `products/izakhono-node/CONNECTA-RUNTIME-FABRIC-DEPLOYMENT-CONTRACT.md`, and `products/izakhono-node/production-deployment-gate.sh` for the operator-controlled activation and promotion gates.
