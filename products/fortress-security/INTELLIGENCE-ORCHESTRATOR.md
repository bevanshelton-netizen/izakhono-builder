# FORTRESS v2.0 — Security Intelligence & Response Orchestrator

FORTRESS v2.0 converts defensive security signals into deterministic, reviewable response decisions.

## Pipeline

`AUTHORIZE → SCOPE → SCAN → STORE → REMEDIATE → RESCAN → VERIFY → AUDIT → INTELLIGENCE → RESPONSE`

## Response model

The orchestrator can recommend notification, critical escalation, rescanning, remediation opening, regression marking, and security review.

It does **not** execute offensive actions, disable systems, obtain credentials, exploit vulnerabilities, or establish persistence.

## Security properties

- deterministic decision IDs
- SHA-256 decision integrity
- tenant-scoped filtering
- severity-aware response policy
- explicit, reviewable action recommendations
- defensive-only operation

Production execution adapters remain a separate control-plane concern and must enforce authorization, audit, rate limits, and tenant isolation before acting on recommendations.
