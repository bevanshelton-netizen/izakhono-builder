# CONNECTA Runtime Fabric Activation

## Purpose

This document defines the operator-controlled activation path for CONNECTA on an approved Runtime Fabric target. It does not provision infrastructure or establish public production status.

## Activation sequence

1. Select an operator-approved runtime target.
2. Run `ops/production-host-preflight.sh` on that target.
3. Pin CONNECTA to an immutable 40-character Git SHA.
4. Deploy PostgreSQL, CONNECTA Engine and Web with the owned Compose contract.
5. Run local health and smoke verification.
6. Complete backup/restore and rollback evidence.
7. Complete protected-port/security evidence.
8. Establish and independently verify EDGE/TLS.
9. Run the independent HTTPS verifier from a separate network.
10. Run `ops/production-deployment-gate.sh`.
11. Promote publicly only if every required evidence artifact is fresh and PASS.

## Provider boundary

Runtime Fabric owns the deployment lifecycle. Provider adapters only request or describe infrastructure. A provider API response is never production evidence. Contabo is an external-resilience adapter and is not the CONNECTA source of truth.

## Fail-closed rules

- No physical NODE01 is assumed.
- No provider server is considered live without machine evidence.
- No DNS/TLS state is inferred from configuration.
- No public route is considered verified from a build or CI result.
- No promotion occurs while any evidence gate is missing, stale, simulated, inferred, topology-only, CI-only, or repository-only.

## Current state

`RUNTIME_TARGET_REQUIRED` until an operator-controlled runtime target is actually supplied and the activation sequence is executed there.
