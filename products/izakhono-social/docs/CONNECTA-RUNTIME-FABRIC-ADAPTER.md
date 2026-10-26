# CONNECTA Runtime Fabric Adapter Contract

Status: `SOFTWARE_PACKAGED`
Public route: `NOT_YET_VERIFIED`

## Purpose

This contract binds CONNECTA to the provider-neutral IZAKHONO Runtime Fabric without making any infrastructure provider the CONNECTA source of truth.

CONNECTA remains the application, data, security and promotion authority. Runtime Fabric supplies an execution target. Provider adapters are replaceable infrastructure mechanisms.

## Deployment handoff

1. Runtime Fabric selects an approved execution target.
2. Provider adapter allocates compute only when explicitly authorized and configured.
3. The target runs `products/izakhono-social/ops/production-host-preflight.sh`.
4. CONNECTA deploys an immutable 40-character Git SHA using `deploy-runtime-fabric.sh`.
5. Local health and application smoke checks must pass.
6. `verify-runtime-release.sh` validates the release and can roll back to the previous immutable SHA.
7. Backup/restore, security, failover, EDGE/TLS and independent HTTPS evidence are collected separately.
8. `production-deployment-gate.sh` evaluates all required evidence.
9. Only a fresh `PRODUCTION_GATES_PASS` permits controlled public promotion.
10. Independent DNS/TLS/routing verification remains mandatory after promotion.

## Contabo boundary

The existing Contabo Runtime Fabric adapter is an **external-resilience provider adapter**. A successful provider API response means only that compute allocation was accepted. It does not prove CONNECTA health, production readiness, DNS, TLS, public routing, backup/restore, failover or LIVE status.

The Contabo adapter must never:

- become CONNECTA's source of truth;
- manufacture readiness evidence;
- mark a node production-ready;
- perform customer DNS/TLS cutover;
- bypass CONNECTA's immutable release or promotion gates;
- expose provider credentials to the application runtime.

## Required environment boundary

Provider credentials stay outside Git and are consumed only by the provider adapter. CONNECTA runtime secrets remain separate (`CONNECTA_DB_PASSWORD`, `CONNECTA_OWNER_KEY`, allowed origins and engine configuration).

The provider layer must not receive or persist CONNECTA customer records as part of compute allocation.

## Failure semantics

A failed provider allocation stops the deployment workflow before application promotion. A healthy provider allocation does not advance CONNECTA beyond `RUNTIME_TARGET_REQUIRED` until host preflight and runtime evidence exist.

A failed CONNECTA release triggers the existing rollback path. A successful rollback is recorded as rollback recovery, not as a successful promotion.

Missing, stale, simulated, inferred, topology-only, CI-only or repository-only evidence cannot authorize public promotion.

## Truthful state model

`SOFTWARE_PACKAGED`
→ `RUNTIME_TARGET_REQUIRED`
→ `HOST_PREFLIGHT_PASS`
→ `DEPLOYMENT_REHEARSAL_PASS`
→ `PRODUCTION_GATES_PASS`
→ `PUBLIC_VERIFIED`

No repository commit, provider API response, CI result, topology declaration or external hosting project may be substituted for physical/runtime evidence.

## Current activation boundary

No Contabo credentials, provisioned server, public DNS/TLS route, or physical NODE01 is asserted by this document. The next activation step requires an operator-controlled runtime target and its actual evidence.
