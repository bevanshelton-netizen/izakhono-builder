# IZAKHONO NODE01 — Software Runtime Build and Replacement

NODE01 is the stable IZAKHONO software/runtime identity. It is not the physical or virtual compute asset. The machine previously used to execute it has been replaced; the same software identity must continue through a separately updated runtime binding.

## Software runtime

- NODE01 control runtime and management API.
- Approved release artifacts and workload contracts.
- Optional OCI/container runtime and private registry.
- Health-gated deployment and rollback.
- Monitoring, backup and restore.

## Replacement procedure

1. Verify the replacement execution environment's actual locator.
2. Update the separate runtime binding; preserve NODE01 identity.
3. Restore approved configuration and data.
4. Start the approved NODE01 software release.
5. Verify software identity and execution-environment separation.
6. Run health, backup/restore, rollback and workload acceptance.
7. Promote only on fresh evidence.

Do not derive the software identity from machine-id, hostname, IP, serial number or cloud instance ID. Do not call the replacement machine NODE01.
