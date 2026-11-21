# IZAKHONO RENT — Payment Event Contract

## Rules

1. A payment intent is created from the server-side booking total.
2. The provider reference is stored server-side; browser redirects never establish payment.
3. Provider callbacks/events must be authenticated by the provider-specific adapter before reaching the lifecycle processor.
4. Event IDs are idempotent. A previously processed event produces a no-op duplicate result.
5. Amount and currency must exactly reconcile with the payment intent before a payment can advance.
6. Provider status transitions are mapped through the internal lifecycle only; raw provider status is never trusted directly by clients.
7. A failed, cancelled, or refunded event cannot be converted to `paid` by client input.
8. Booking activation requires the internal payment state required by the booking state machine.
9. Raw payloads are represented by a hash/reference for auditability; secrets and credentials are never persisted in application tables.
10. The iKhokha adapter remains fail-closed until the exact current merchant API and callback authentication contract is verified.

## Internal flow

`booking -> payment intent -> provider session -> authenticated provider event -> idempotency check -> amount/currency reconciliation -> payment state -> booking transition`

## iKhokha gate

The implementation intentionally does not invent endpoint paths, request fields, signature algorithms, or callback headers. Those values must come from the current iKhokha merchant documentation and approved credentials before production payment activation.
