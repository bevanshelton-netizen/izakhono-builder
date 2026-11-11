# NODE01 Software Runtime — Execution Environment Requirements

## Identity boundary

**NODE01 IS SOFTWARE. NODE01 IS NOT PHYSICAL INFRASTRUCTURE.**

This document specifies optional procurement requirements for a separately managed execution environment capable of running IZAKHONO NODE01 software. The server, workstation, virtual machine, cloud instance, container host, network and power equipment are execution infrastructure only. None of these assets is NODE01, and none may be named or treated as NODE01.

## Reference execution-environment profile

| Component | Reference requirement |
|---|---|
| Compute | 24–32 enterprise CPU cores, sized to workload |
| Memory | 128 GB ECC minimum; 256 GB target |
| Boot storage | Mirrored enterprise NVMe |
| Workload storage | Redundant enterprise NVMe/SAS SSD |
| Networking | Redundant 10 GbE where workload requires |
| Management | Isolated out-of-band management |
| Security | TPM 2.0 and Secure Boot where supported |
| Power | Redundant power supplies and protected power |

## Facility and resilience

- UPS sized for controlled shutdown and runtime margin.
- Separate backup storage failure domain.
- Appropriate rack cooling and airflow.
- Spare drives and documented replacement procedures.
- Tested console and recovery access.

## Procurement and binding

Procurement is independent of NODE01 software identity. The selected execution environment must be recorded through `izakhono.runtime-binding/v1`, with a real environment locator distinct from NODE01. Replacing, migrating, scaling or losing the environment must not change the NODE01 software identity.

Use **NODE01 execution environment** or the actual infrastructure locator when referring to the purchased asset.
