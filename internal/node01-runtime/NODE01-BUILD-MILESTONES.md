# NODE01 Software Runtime — Delivery Milestones

## M1 — Software identity and architecture
- Stable NODE01 software identity.
- Separate, replaceable execution-environment binding.
- Runtime contract and acceptance policy.

## M2 — Software runtime foundation
- NODE01 controller and service contracts.
- Immutable release and artifact identity.
- Health-gated deployment and rollback.

## M3 — Resilience
- Backup and restore procedure.
- Health guard and heartbeat.
- Recovery and environment-replacement runbook.

## M4 — Replacement environment binding
- Identify the actual replacement execution environment.
- Verify its locator and ownership.
- Bind the existing NODE01 software identity.
- Confirm old environment is not still the active binding.

## M5 — Runtime acceptance
- Install/start the approved software release.
- Verify software identity and environment separation.
- Verify dependencies, health, backup/restore and recovery.
- Verify edge/DNS/TLS independently where applicable.

## M6 — Workload promotion
- Promote approved workloads only after acceptance.
- Retain previous known-good artifact for rollback.
- Record timestamped release and acceptance evidence.

## Definition of done

NODE01 identity remains stable across replacement. The replacement environment is bound and verified; the software runtime, workloads, recovery and required public routes pass their independent acceptance gates. Repository artifacts alone are not runtime evidence.
