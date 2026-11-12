# IZAKHONO NODE01 Software Runtime

**NODE01 is software, not a physical or virtual machine.** The execution environment is separately managed and replaceable. The previous machine has been replaced; the same NODE01 software identity continues on the replacement through an updated runtime binding.

## Components

- Control runtime and health/status API.
- Workload and release contracts.
- Optional private OCI registry and container runtime, where appropriate.
- Health-gated promotion, monitoring and rollback.
- Backup, restore and replacement runbooks.

## Binding

The runtime binding carries `logical_node_id: NODE01`, `identity_type: software-runtime`, a distinct `runtime_host` locator and `runtime_host_is_separate: true`. The locator must identify the actual replacement environment. A placeholder or unknown locator is not a verified binding.

## Production

CI, a repository topology, an installed package or a successful local test does not prove the replacement environment is live. Require current runtime health, release identity, backup/restore and independent route acceptance.
