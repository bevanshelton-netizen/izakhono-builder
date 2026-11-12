# Execution Environment — Operating System Baseline

## Identity boundary

NODE01 is software. The operating system is part of the separate execution environment and may be replaced or migrated without changing NODE01's identity.

## Baseline where Linux is selected

- Supported Ubuntu Server LTS or equivalent enterprise Linux.
- Security updates and controlled reboot policy.
- SSH keys, least privilege and disabled password SSH.
- Default-deny host firewall.
- AppArmor or equivalent mandatory access controls.
- Time synchronisation and bounded persistent logs.
- Docker/OCI only where required by the selected deployment model.
- Secrets outside Git and release artifacts.
- Independent backup and recovery paths.

## Acceptance

Validate the actual replacement environment's OS patching, access controls, firewall, runtime dependencies, service health, backup/restore and reboot recovery. Do not infer the active OS or environment from this reference document.
