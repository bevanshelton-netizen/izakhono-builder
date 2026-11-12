# IZAKHONO NODE01 — Software Platform Architecture

## Mission

NODE01 is IZAKHONO's stable software/runtime control-plane identity. It governs approved workload deployment and service capabilities. It is not the physical or virtual machine on which it executes.

## Layers

1. **NODE01 software identity:** stable logical identity, release and control-plane behaviour.
2. **Execution environment:** separately managed physical, virtual, container or cloud substrate. This is replaceable and identified only by its runtime binding.
3. **Runtime adapter:** OS/container/serverless execution mechanism appropriate to the selected environment.
4. **Workload layer:** approved applications and services with immutable artifact identities and health contracts.
5. **Private service network and registry:** deployment dependencies, not NODE01 identity.
6. **Edge:** separately managed public routing and TLS, promoted only after independent verification.
7. **Resilience:** backups, restore, rollback and re-binding to a replacement execution environment.

## Replacement flow

`existing NODE01 software identity → update runtime binding → restore approved state → verify runtime → verify workloads → acceptance → promotion`

The former execution machine has been replaced. Do not reuse its locator as the current binding. Do not generate a new NODE01 identity from the replacement machine's fingerprint.

## Non-negotiable rules

- NODE01 is software.
- Execution environments are separate and replaceable.
- Owned-first, externally reversible.
- No unverified production claims.
- Health before promotion.
- Backup and rollback before recovery completion.
