# IZAKHONO NODE Promotion Contract

The IZAKHONO NODES are the physical foundation of the IZAKHONO owned-first infrastructure strategy.

## Promotion rule

The autonomous execution system may promote workloads to an IZAKHONO NODE only after the node reports verifiable evidence for:

1. `node-reachable`
2. `node-authenticated`
3. `container-runtime-ready`
4. `persistent-storage-ready`
5. `backup-tested`
6. `security-gate-passed`
7. `monitoring-online`

A node that does not provide all required evidence remains an external/physical-infrastructure gate. The system must not claim that a workload is live on the node without deployment evidence.

## Runtime model

`IZAKHONO Control Plane → Execution Queue → Node Agent → Container Runtime → Workload`

The Node Agent must accept authenticated, idempotent deployment instructions and return machine-readable evidence. Secrets are referenced through FORTRESS and are never embedded in deployment manifests or source code.

## External fallback

External providers remain reversible adapters while node capacity is being commissioned. They must not become architectural dependencies when an equivalent IZAKHONO NODE capability is available.

## Promotion sequence

`DISCOVER → AUTHENTICATE → HEALTH CHECK → STORAGE CHECK → BACKUP CHECK → SECURITY CHECK → DEPLOY → VERIFY → RECORD EVIDENCE → PROMOTE`

## Failure behavior

A failed health, security, backup, or verification check blocks promotion and preserves the workload on its current verified runtime. The system should repair or retry where safe; it must not bypass a security or data-integrity gate.
