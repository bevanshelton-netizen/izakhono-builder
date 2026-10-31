# IZAKHONO MAIL CONTROL CENTRE — API V1

The Mail Control Centre API is the read-side control-plane service for managed business email.

## Supported operations

- `read-dashboard` — executive health snapshot
- `read-domain` — domain/DNS/authentication state
- `read-mailbox` — mailbox operational state without message content
- `read-incidents` — security and delivery incidents

## Authorization

Supported roles:

- Owner
- Mail Administrator
- Security Administrator
- Support Administrator
- Auditor

All supported roles may read operational state. Message content is outside this API and requires a separate, explicitly permissioned and audited capability.

## Safety rules

1. No endpoint exposes mailbox message bodies.
2. Configuration does not equal production readiness.
3. Domain health requires current verification evidence.
4. Unknown roles are denied by default.
5. Mutating/destructive operations are not part of this read API and require a separate confirmation + audit path.
6. Production claims remain evidence-gated.

## Data source

V1 reads the persisted Mail Control Centre state contract. Later adapters may populate the same contract from IZAKHONO MAIL, external fallback transport, DNS verification, monitoring and backup systems without changing the dashboard contract.
