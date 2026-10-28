# FORTRESS v1.7 Reporting Contract

## Export authorization

Reports may be exported only by `OWNER`, `SECURITY_ADMIN`, or `ANALYST`. `VIEWER` is read-only and cannot create an export.

## Report contents

Each report is tenant-scoped and includes the explicit scan scope, scan IDs, generated timestamp, finding totals, severity distribution, remediation distribution, risk score, report ID and integrity digest.

## Integrity

The report payload is canonicalized and hashed with SHA-256. `verifySecurityReport` detects post-generation modification.

## Redaction

`redactReport` removes secret-like inline values from finding titles before controlled sharing. It is a defense-in-depth convenience, not a replacement for proper evidence classification or access control.

## Output

The report object is JSON-compatible and can be rendered to Markdown. No claim is made that this implementation alone provides encryption at rest, external immutable storage, legal non-repudiation, regulatory certification, or production deployment.
