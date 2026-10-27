# IZAKHONO FORTRESS SECURITY™

Authorized defensive vulnerability discovery, remediation planning, retesting, verification and security-history platform.

## Purpose

FORTRESS SECURITY is the defensive scanning layer of the IZAKHONO security fabric. It inspects explicitly authorized assets, identifies exposed services and high-confidence configuration weaknesses, produces explainable findings, and verifies remediation after changes.

**Flow:** `AUTHORIZE → DISCOVER → ASSESS → PRIORITIZE → REMEDIATE → RESCAN → VERIFY → EVIDENCE`

## Persistent security history

The v1.4 persistence layer stores completed scans, the current remediation ledger and evidence digests for traceability. Storage is behind a replaceable interface so an IZAKHONO-owned database, object store or encrypted security vault can replace the reference store without changing scanner logic.

## Tamper-evident audit chain

The v1.6 audit layer links each security event to the preceding event using SHA-256 hashes. Each event carries a deterministic ID, sequence number, previous hash and event hash. Verification rejects modified events, reordered events and appends to a corrupted chain.

The chain provides integrity evidence; it does **not** by itself provide encryption at rest, external immutability or legal non-repudiation. Those require separately verified infrastructure and key-management controls.

## Safety boundary

- Scans require `FORTRESS_AUTHORIZED_SCAN=1`.
- Every target must be explicitly listed in the scan scope.
- No credential guessing, password spraying, exploit execution, destructive testing, persistence, malware, or unauthorized target discovery.
- The implementation uses safe TCP connection checks and HTTP/TLS inspection only.
- Findings are evidence-backed signals and are not proof of compromise.

## v1 checks

- HTTP security headers
- HTTP TRACE exposure
- exposed `phpinfo.php`
- exposed `.env` path detection (without retrieving secrets)
- TLS certificate expiry/hostname validation
- common management/database service exposure by explicit port list
- service exposure severity and remediation guidance
- deterministic JSON evidence records via SHA-256 digest

## Lifecycle

`AUTHORIZE → SCOPE → SCAN → STORE → REMEDIATE → RESCAN → VERIFY → AUDIT → EXPORT`
