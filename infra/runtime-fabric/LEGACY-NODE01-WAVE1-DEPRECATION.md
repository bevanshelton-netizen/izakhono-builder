# Legacy NODE01 Wave 1 certification — deprecated

Status: **DEPRECATED / NOT A CONNECTA PRODUCTION GATE**

The former `CERTIFY-WAVE1-OWNED.ps1` and `PUSH-WAVE1-OWNED.ps1` flow was designed around a physical/workstation-style NODE01 evidence model, Desktop reports, and local launcher execution.

That model is no longer authoritative for CONNECTA.

## Canonical CONNECTA path

`IZAKHONO CODE → IZAKHONO CONTROL → NODE01 → NODE02 → NODE03 → NODE04 → IZAKHONO EDGE/TLS → CONNECTA`

NODE01–NODE04 are logical/runtime nodes. They are not required to be physical desktops or workstations.

The authoritative CONNECTA certification path is:

1. `NODE-CLUSTER-HEALTH-GATE.sh` collects actual runtime evidence for NODE01–NODE04.
2. `VERIFY-NODE-CLUSTER-EVIDENCE.sh` validates the evidence contract.
3. `CONNECTA-PROMOTION-GATE.sh` makes the fail-closed promotion decision.
4. `.github/workflows/connecta-owned-runtime-certification.yml` performs four-node certification.
5. `.github/workflows/connecta-promotion-gate.yml` is the production promotion dependency.
6. `CERTIFY-OWNED-RUNTIME-WAVE1.ps1` may consume cluster evidence for full runtime/EDGE/TLS/DNS/smoke/rollback certification where PowerShell execution is appropriate.

## Truth boundary

No legacy NODE01 report, Desktop artifact, local launcher, topology declaration, CI result, or repository configuration may be treated as proof that the CONNECTA four-node runtime is live.

Public LIVE verification remains blocked until current runtime evidence proves all required gates.
