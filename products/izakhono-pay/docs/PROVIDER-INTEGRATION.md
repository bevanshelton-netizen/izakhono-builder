# IZAKHONO PAY provider integration boundary

IZAKHONO PAY owns the merchant experience, API, orchestration, transaction state, idempotency, ledger metadata, reconciliation records and analytics. A provider adapter is the replaceable execution boundary for regulated payment processing.

## Pilot

`IzakhonoSandboxProvider` is deterministic and does not move real money. Use it to exercise the full transaction lifecycle before connecting a regulated provider.

## Production adapter requirements

A production adapter must implement:

- payment creation / checkout handoff
- refund request
- webhook authenticity verification
- webhook event parsing
- provider reference mapping
- explicit failure/reversal handling

No provider credentials, customer funds, settlement claims or regulatory permissions are embedded in the core application. Production activation requires the relevant commercial, security and regulatory controls.
