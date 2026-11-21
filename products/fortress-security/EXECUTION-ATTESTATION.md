# FORTRESS Execution Attestation

The execution attestation layer provides a deterministic, tamper-evident record linking a downstream adapter result to its tenant, enforcement decision, adapter, action, target, timestamp, outcome, and reason.

## Control chain

`INTELLIGENCE → POLICY → APPROVAL → ENFORCEMENT → ADAPTER → ATTESTATION → AUDIT`

## Guarantees

- Tenant context is recorded in every attestation.
- The enforcement decision identifier is recorded as the execution anchor.
- Adapter, action and target are explicit.
- Outcomes are restricted to `SUCCESS`, `DENIED`, or `FAILED`.
- SHA-256 produces deterministic IDs and integrity hashes.
- Verification recomputes both the attestation ID and integrity hash.
- Tampering with any attested field causes verification failure.

This layer records and verifies execution claims; it does not itself perform external actions, network remediation, privilege escalation, or offensive security operations.
