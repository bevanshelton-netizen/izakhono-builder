# Payment → Entitlement V1 Production Gate

Before this boundary can be considered production-ready, the implementation must demonstrate:

1. Provider webhook signature verification.
2. Idempotent event processing and replay protection.
3. Durable entitlement persistence.
4. Explicit handling for PAID, REFUNDED, CANCELLED and FAILED states.
5. Reconciliation between provider transactions and entitlement records.
6. Audit trail for every entitlement mutation.
7. Retry/dead-letter handling for failed events.
8. Tenant isolation.
9. Playback-time entitlement and rights-window revalidation.
10. End-to-end authorization tests using real provider sandbox events.

Until these gates pass with evidence, the adapter remains reference-only and IZAKHONO STREAM must not be represented as having live payment-to-playback capability.
