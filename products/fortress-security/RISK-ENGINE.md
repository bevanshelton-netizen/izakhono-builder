# FORTRESS v1.9 — Continuous Risk Engine

FORTRESS v1.9 adds a defensive risk-event engine that turns verified security observations into tenant-scoped alerts.

## Detection classes
- New CRITICAL/HIGH findings
- Remediation regressions
- Configurable risk-score jumps
- Stale scans
- Certificate expiry windows
- Repeated scan/control failures

## Alert lifecycle
`OPEN → ACKNOWLEDGED → RESOLVED`

`SUPPRESSED` is available for controlled operational suppression.

## Controls
- Deterministic event fingerprints and alert IDs
- Configurable deduplication/cooldown window
- Explicit tenant ownership on every alert
- Cross-tenant lifecycle changes rejected
- Defensive-only; no exploitation, credential attacks, persistence, or active attack automation

This layer is an application/control-plane contract. It does not by itself claim a deployed production alerting service, notification provider, encryption-at-rest implementation, or regulatory certification.
