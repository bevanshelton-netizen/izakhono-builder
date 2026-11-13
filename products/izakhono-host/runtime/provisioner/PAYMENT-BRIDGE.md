# IZAKHONO HOST paid-provisioning bridge

This bridge connects an already-verified payment intent to the HOST provisioning state machine. It does not receive public webhooks and does not trust a browser success redirect.

## Trust boundary

1. The payment provider adapter verifies the provider's signature against the exact raw webhook body.
2. The payment webhook guard claims the provider transaction/outcome idempotently and rejects contradictory duplicates.
3. The payment store resolves the transaction and records the verified paid status.
4. The caller supplies that persisted `paid` intent and the server-side checkout order snapshot to `PaidProvisioningBridge`.
5. The bridge checks payment status, exact integer amount, ISO currency, transaction identity, customer, domain and checkout idempotency key.
6. The store atomically inserts or reads the provisioning record under a UNIQUE `idempotency_key`. Same payment/order returns the original record; a different payment/order under the same key is rejected.

The result is `PAYMENT_VERIFIED`, never `LIVE`. Domain registration, DNS, website, TLS, mail and acceptance remain separate gated transitions.

## Store adapter requirement

Implement `createOrGetByIdempotencyKey(record)` with a database transaction or atomic insert-on-conflict backed by a unique constraint. Do not implement it as an unprotected read-then-write sequence. Return `{ outcome: 'created' | 'existing' | 'conflict', record }`. An existing record is equivalent only if payment intent, external transaction, amount, currency, customer and normalized domain all match.

The checkout idempotency key must be created server-side and persisted with the order before redirecting the customer to a payment provider. Never accept the expected amount, currency, customer ID or domain from the webhook body.

## iKhokha

The repository already contains the iKhokha payment-link adapter and payment webhook guard in `products/izakhono-super-engine/src/payment-core.ts` and `payment-webhook-guard.ts`. Keep iKhokha credentials server-side. Route callback bytes to the provider's existing signature verifier before parsing or calling this bridge. Do not infer payment success from a return URL.

This bridge does not activate an iKhokha merchant account, supply credentials, call iKhokha, or claim a live payment integration. Confirm the current merchant/API contract and callback signature requirements with the merchant's enabled iKhokha documentation before production enablement.

## Test

Run:

```bash
node products/izakhono-host/runtime/provisioner/payment-bridge.test.mjs
```
