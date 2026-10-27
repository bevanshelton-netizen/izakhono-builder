# CONNECTA Production Release Contract

## Release identity

- Product: CONNECTA by IZAKHONO
- Web package: `products/izakhono-social`
- Engine: CONNECTA discovery engine 0.3.0
- Source of truth: `main` at an immutable 40-character Git SHA
- Runtime target: IZAKHONO-owned runtime
- Production target: an operator-selected approved runtime. The logical runtime identity is provider-neutral; compute placement, failover and resilience are operational decisions, not product architecture.
- Physical hardware: **not required**. Hardware is an implementation resource, not a release dependency.

## Runtime model

CONNECTA is packaged once and executed through the IZAKHONO software runtime contract.

```text
IMMUTABLE RELEASE
      |
      v
IZAKHONO SOFTWARE RUNTIME
      |
      +--> owned compute when available
      +--> approved cloud/compute fallback when required
      |
      v
APPLICATION SERVICES
      |
      v
EDGE / TLS / DNS
      |
      v
PUBLIC HTTPS
```

The logical runtime identity replaces the former physical NODE01 dependency. The same immutable release must remain portable across approved execution targets without rebuilding the product.

## Release states

1. `SOFTWARE_PACKAGED` — source, web package, engine, compose assets and verification gates exist.
2. `RUNTIME_TARGET_REQUIRED` — an approved execution target has not yet been selected and verified for this release.
3. `RUNTIME_PREFLIGHT_PASS` — the selected execution target satisfies the provider-neutral runtime contract.
4. `DEPLOYMENT_REHEARSAL_PASS` — the exact immutable release can boot and pass local health checks.
5. `PRODUCTION_GATES_PASS` — runtime, failover, backup/restore, security, EDGE/TLS and external HTTPS evidence all pass.
6. `PUBLIC_VERIFIED` — external HTTPS is independently verified against the promoted immutable release.

## Non-negotiable release rules

- Never call CONNECTA live, public, commercial GA, or production verified from CI alone.
- Never treat Vercel availability or deployment status as proof of production readiness.
- Never require a physical server, physical NODE01, or hardware-specific identity as a software release prerequisite.
- Never substitute repository files, CI output, topology declarations, or inferred infrastructure for actual runtime evidence.
- Never expose PostgreSQL or administrative control ports publicly.
- Production promotion requires the existing IZAKHONO production deployment gate and all required evidence classes.
- Every production release must be rollback-capable and tied to an immutable Git SHA.
- External compute remains a reversible fallback; the application release and runtime contract remain IZAKHONO-controlled.

## Current gate

The software release is packaged and CI-verifiable. The remaining promotion dependency is verification of an approved execution target and the required runtime/production evidence. There is **no physical NODE01 prerequisite**. Until the required runtime and production gates pass, the truthful public status remains **NOT YET VERIFIED**.

## Activation sequence

```text
SOFTWARE_PACKAGED
  -> RUNTIME_TARGET_REQUIRED
  -> RUNTIME_PREFLIGHT_PASS
  -> DEPLOYMENT_REHEARSAL_PASS
  -> PRODUCTION_GATES_PASS
  -> PUBLIC_VERIFIED
```

See `products/izakhono-node/CONNECTA-RUNTIME-FABRIC-ACTIVATION.md`, `products/izakhono-node/CONNECTA-RUNTIME-FABRIC-DEPLOYMENT-CONTRACT.md`, and `products/izakhono-node/production-deployment-gate.sh` for the operator-controlled activation and promotion gates.
