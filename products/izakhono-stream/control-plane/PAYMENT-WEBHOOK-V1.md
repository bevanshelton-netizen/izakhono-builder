# IZAKHONO STREAM — Payment Webhook Boundary V1

The payment boundary is deliberately provider-neutral. iKhokha is the preferred South African adapter, while provider-specific verification remains replaceable.

## Security order

1. Identify tenant.
2. Verify provider signature against the raw provider payload.
3. Construct a stable event key.
4. Check durable replay/idempotency state.
5. Record the event atomically.
6. Translate verified payment state into entitlement state.
7. Revalidate entitlement during playback authorization.

The client must never be trusted as proof of payment. Provider credentials, webhook secrets, origin credentials and DRM secrets must never be returned to clients.

## Reference status

This boundary is a reference implementation and does not claim live iKhokha webhook verification or production payment processing.
