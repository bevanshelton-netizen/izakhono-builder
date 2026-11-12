# IZAKHONO NODE01 — Execution Environment Hardware Reference

## Identity boundary

**NODE01 IS SOFTWARE.** This document describes one possible physical execution environment, not NODE01 itself and not a claim about the current replacement machine.

## Reference physical configuration

| Component | Reference requirement |
|---|---|
| Form factor | 2U enterprise rack server, if rack hardware is selected |
| CPU | Current-generation server CPU sized to workload |
| RAM | 128 GB ECC minimum; 256 GB target |
| OS storage | Mirrored enterprise NVMe |
| Application storage | Redundant NVMe/SAS storage |
| Backup storage | Separate failure domain |
| Network | Redundant production interfaces and isolated management |
| Security | TPM 2.0 and Secure Boot where supported |
| Power | Protected power and redundant supplies |
| Cooling | Controlled environment with temperature monitoring |

## Execution-environment options

NODE01 software may run on an approved physical host, virtual machine, VPS, container platform or other execution substrate. The chosen environment must be recorded using its real locator in the runtime-binding contract.

## Acceptance

Physical diagnostics apply only if the selected environment is physical hardware. In all cases, verify software identity, binding separation, runtime health, artifact identity, backup/restore and required service acceptance independently.

## Replacement continuity

The machine can be replaced without changing the NODE01 software identity. The runtime binding changes; the logical identity does not.
