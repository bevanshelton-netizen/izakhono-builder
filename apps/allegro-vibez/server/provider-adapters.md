# Provider Adapter Boundary

ALLEGRO VIBEZ keeps payment, storage and messaging providers outside the core domain model.

## Payments
Implement adapters for:
- iKhokha
- Stripe
- PayFast (where required for legacy compatibility)

Each adapter exposes:
- `createCheckout(order)`
- `verifyWebhook(request)`
- `normalizeEvent(event)`
- `refund(transaction)`

No adapter may write directly to wallet balances. Normalized events enter the transaction service, which performs idempotent ledger writes.

## Storage
Implement an IZAKHONO Object Storage adapter with S3-compatible semantics:
- signed upload URL
- signed read URL
- object metadata
- delete/archive
- checksum verification

External object storage is a reversible fallback, not the permanent architecture.

## Identity
The API gateway owns sessions and authorization. The database stores user state; credentials and secrets never enter the browser bundle.
