# Payment merchant identity and trust boundaries

## Canonical identity

A payment intent owns exactly one immutable `merchantId` and one immutable `serviceId` entitlement. Both values are resolved by the server-injected `PaymentOwnershipResolver` from an authenticated principal and server-side order context at payment creation. Do not accept `merchantId` from request bodies, query strings, browser state, provider webhooks, or fulfilment messages.

The application route must:
1. Authenticate the caller using the platform's server-side session/token verifier.
2. Pass only the verified principal context to `IzakhonoPay.createPayment(input, context)`.
3. Configure the resolver to map that verified principal to the canonical, active merchant record. The resolver must reject unknown, suspended, or unmapped principals and must derive the service entitlement from the authoritative server-side order/catalogue—not from a client-supplied service identifier.
4. Keep the resolver and provider credentials in server-only code.

The TypeScript context is a boundary contract, not an authentication mechanism. A caller that passes an unverified principal identifier defeats the trust model; route-level authentication and resolver enforcement are mandatory release gates.

## Downstream ownership

- Payment intents are reloaded from the payment store before ledger, refund, reconciliation, receipt, and fulfilment operations.
- Ledger merchant accounts and refund journal entries derive merchant identity from the canonical payment intent.
- Fulfilment jobs derive both `merchantId` and `serviceId` from the payment intent; their payment, merchant, and service bindings are immutable.
- The paid-event merchant and service must exactly match the canonical payment intent.
- SQL enforces the fulfilment/payment merchant pair with a composite foreign key.

## Provider evidence

The iKhokha webhook payload documents `paylinkID`, `status`, `externalTransactionID`, and `responseCode`, but does not include amount or currency. The adapter therefore verifies the signed webhook and then calls iKhokha's `getStatus/external?externalReference=...` endpoint. The provider status response's `paylinkID` and integer minor-unit `amount` must match the intent. Currency is taken from the immutable intent because it is the currency sent in the original signed payment-link creation request; the status endpoint does not independently return currency.

Do not mark a payment paid if the status lookup is unavailable, the provider reference differs, the amount differs, or the provider status contradicts the webhook. Retry or quarantine the webhook; do not fall back to webhook-only trust.

## Database migration

`sql/008_payment_intent_merchant_identity.sql` intentionally fails if existing payment intents have no merchant mapping or if an existing fulfilment job's merchant differs from its payment. Existing rows must be mapped only from auditable, authoritative evidence before this migration can succeed. Never bulk-assign a default merchant to make the migration pass.

The migration has not been applied to any remote database. Run it first against a disposable local database and a reviewed snapshot. Remote application requires a separate approved change window and verified backup/rollback plan.

## Remaining release gates

This change binds merchant identity across the code and schema boundaries. It does not, by itself, prove atomicity across payment status, durable ledger posting, paid-event/outbox publication, and fulfilment retries. The release blocker remains open until durable integration/replay/concurrency tests, the authenticated route-to-resolver wiring, provider sandbox evidence, migration rehearsal, and independent security review pass. Live payments and production deployment remain disabled.
