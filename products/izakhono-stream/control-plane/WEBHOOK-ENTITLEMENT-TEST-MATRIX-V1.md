# Webhook → Entitlement Test Matrix V1

| Case | Expected |
|---|---|
| Valid PAID event | Accept and activate entitlement |
| Same event replay | Accept idempotently; no duplicate entitlement |
| Invalid signature | Reject; no entitlement mutation |
| REFUNDED | Revoke entitlement |
| CANCELLED | Revoke entitlement |
| FAILED | Revoke / prevent entitlement |
| Cross-tenant event | Reject before entitlement mutation |
| Concurrent replay | Exactly one durable event record |

All production cases require provider sandbox evidence and durable persistence tests before the production-live gate is opened.
