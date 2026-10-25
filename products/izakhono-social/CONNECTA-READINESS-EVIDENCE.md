# CONNECTA Production Readiness Evidence Contract

CONNECTA uses a fail-closed production state machine. The state machine never treats GitHub, CI, topology, a hostname, or an unverified server as physical proof.

## State machine

`SOFTWARE PACKAGED -> PHYSICAL NODE PROOF -> LOCAL CONNECTA PROOF -> FAILOVER/RECOVERY -> SECURITY -> EDGE/TLS -> EXTERNAL HTTPS -> PRODUCTION READY`

The machine-side state runner is:

`CONNECTA-READINESS-STATE.sh`

It writes a protected JSON report and **never changes DNS, FORTRESS, EDGE/TLS, routing, or `.izakhono.json`**.

## Required evidence files

Place these under `/var/lib/izakhono/evidence/connecta` (or set `CONNECTA_EVIDENCE_ROOT`):

| File | Required schema | Meaning |
| --- | --- | --- |
| `cluster-physical.json` | `izakhono.connecta.gate.cluster-physical.v1` | Actual required physical runtime/node evidence passed |
| `connecta-local.json` | `izakhono.connecta.gate.local.v1` | Immutable CONNECTA deployment, `/health`, registration/login and persistence proof passed on owned runtime |
| `failover.json` | `izakhono.connecta.gate.failover.v1` | Controlled failure/failback proof passed |
| `backup-restore.json` | `izakhono.connecta.gate.backup-restore.v1` | PostgreSQL/media backup and recovery proof passed |
| `security.json` | `izakhono.connecta.gate.security.v1` | Secrets, encryption, private DB/admin ports and required security checks passed |
| `edge-tls.json` | `izakhono.connecta.gate.edge-tls.v1` | FORTRESS/EDGE/TLS and approved DNS proof passed |
| `external-https.json` | `izakhono.connecta.gate.external-https.v1` | Independent outside-network HTTPS acceptance passed |

Every artifact must contain at least:

```json
{
  "schema": "<required schema>",
  "status": "PASS",
  "evidence_source": "<actual verifier>",
  "checked_at_epoch": 0
}
```

`evidence_source` may not be `inferred`, `topology`, `ci-only`, or `repository-only`.

## Promotion rule

Only when all seven artifacts validate as `PASS` does the state machine emit:

`CONNECTA_PRODUCTION_READINESS=PRODUCTION_READY`

Anything missing, malformed, stale, or failed produces `NOT_READY` and exit code `4`.

A passing state-machine result is **permission to perform the final promotion procedure**, not evidence that promotion already occurred.

## Current boundary

The repository currently packages CONNECTA for the owned route:

`IZAKHONO CODE -> NODE01 -> PostgreSQL + CONNECTA ENGINE + CONNECTA Web -> FORTRESS -> EDGE/TLS -> IZAKHONO DNS`

The CONNECTA release metadata remains **NOT YET PUBLIC** until actual evidence is produced. The existing public launch gate likewise requires physical NODE01 deployment, backup/restore, FORTRESS/EDGE/TLS, DNS, independent HTTPS and rollback/failback proof before public status is changed.
