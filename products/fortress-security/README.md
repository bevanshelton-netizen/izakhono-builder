# IZAKHONO FORTRESS SECURITY™

Authorized defensive vulnerability discovery, remediation planning, retesting, verification, security-history and controlled reporting platform.

## Purpose

FORTRESS SECURITY is the defensive scanning layer of the IZAKHONO security fabric. It inspects explicitly authorized assets, identifies exposed services and high-confidence configuration weaknesses, produces explainable findings, verifies remediation after changes, and creates tenant-scoped security reports.

**Flow:** `AUTHORIZE → DISCOVER → ASSESS → PRIORITIZE → REMEDIATE → RESCAN → VERIFY → EVIDENCE → REPORT`

## v1.7 Evidence Export & Security Reporting

The reporting engine creates deterministic tenant-scoped reports containing scan scope, scan identifiers, finding counts, severity distribution, remediation state and risk score. Report integrity is protected by a SHA-256 digest and can be independently verified.

Export is restricted to `OWNER`, `SECURITY_ADMIN` and `ANALYST`. `VIEWER` cannot export reports. Redaction is available before controlled sharing to reduce accidental disclosure of secret-like strings.

Supported human-readable output is Markdown; the underlying report object is JSON-compatible. This layer does not claim encryption at rest, external immutability, legal non-repudiation, or production compliance certification.

## Persistent security history

The v1.4 persistence layer stores every completed scan under a timestamped record, the current remediation ledger, and evidence digests for traceability. This enables later comparisons and regression detection.

`FileFortressStore` is the local/owned-node reference implementation. Storage is deliberately behind a small interface so an IZAKHONO-owned database, object store, or encrypted security vault can replace it without changing scanner logic.

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

`AUTHORIZE → SCOPE → SCAN → STORE → REMEDIATE → RESCAN → VERIFY → STORE → AUDIT → REPORT`

Production deployment, encryption-at-rest guarantees and multi-tenant isolation are not claimed by this reference store. Those controls must be implemented and verified before production security data is used.
