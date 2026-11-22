# CONNECTA Production Readiness Evidence Contract

CONNECTA uses a fail-closed, provider-neutral production state machine. It verifies the approved logical software runtime and the exact immutable release; it does not require a particular physical server or hardware identity.

## State machine

`SOFTWARE PACKAGED -> APPROVED RUNTIME -> LOCAL CONNECTA PROOF -> FAILOVER/RECOVERY -> SECURITY -> EDGE/TLS -> EXTERNAL HTTPS -> PRODUCTION READY`

The machine-side state runner is:

`CONNECTA-READINESS-STATE.sh`

It writes a protected JSON report and **never changes DNS, FORTRESS, EDGE/TLS, routing, or `.izakhono.json`**.

## Required evidence files

Place these under `/var/lib/izakhono/evidence/connecta` (or set `CONNECTA_EVIDENCE_ROOT`):

| File | Required evidence |
| --- | --- |
| `runtime.ok` | Approved logical runtime identity and provider |
| `health.ok` | Actual web + engine health on the selected runtime |
| `persistence.ok` | Registration/login and persisted application data proof |
| `backup_restore.ok` | PostgreSQL/media backup integrity and non-destructive restore proof |
| `failover.ok` | Controlled failover and failback proof |
| `security.ok` | Secrets, encryption, private DB/admin ports and security checks |
| `edge_tls.ok` | FORTRESS/EDGE/TLS and approved DNS proof |
| `external_https.ok` | Independent outside-network HTTPS acceptance |

Each artifact is JSON and must include at least:

```json
{
  "status": "PASS",
  "evidence_source": "<actual runtime or independent verifier>",
  "checked_at_epoch": 0,
  "release_sha": "<40-character immutable Git SHA>",
  "runtime_id": "<logical runtime identity>",
  "runtime_provider": "<approved runtime provider>",
  "physical_hardware_required": false
}
```

Evidence sources may not be `inferred`, `topology`, `ci-only`, `repository-only`, or `simulated`. All artifacts must identify the same release SHA, runtime ID and provider, and must be fresh within the configured evidence window.

The local runtime launcher generates the first four artifacts only after actual deployment, health, persistence, backup and restore checks pass. Failover, security, EDGE/TLS and external HTTPS require their respective independent/operator verifiers.

## Promotion rule

Only when all eight artifacts validate as `PASS` does the state machine emit:

`CONNECTA_PRODUCTION_READINESS=PRODUCTION_READY`

Anything missing, malformed, inconsistent, stale, or failed produces `NOT_READY` and exit code `4`.

A passing state-machine result is **permission to perform the final promotion procedure**, not evidence that promotion already occurred.

## Current boundary

The canonical product route is provider-neutral:

`IZAKHONO CODE -> APPROVED IZAKHONO SOFTWARE RUNTIME -> PostgreSQL + CONNECTA ENGINE + CONNECTA Web -> FORTRESS -> EDGE/TLS -> IZAKHONO DNS`

Owned compute is preferred; an approved external runtime may be used as a reversible fallback. No physical NODE01 prerequisite exists. Public status remains **NOT YET VERIFIED** until actual runtime, recovery, security, DNS/TLS and independent HTTPS evidence is present.
