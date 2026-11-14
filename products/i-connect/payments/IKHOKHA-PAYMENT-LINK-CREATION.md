# I-CONNECT iKhokha payment-link creation

## Design
- Caller supplies only an existing transaction UUID. Amount, currency, merchant and external reference are loaded from the server-side ledger.
- The Edge Function requires a valid Supabase user and active owner/admin membership in the active `izakhono` organization.
- The transaction ledger records the requested provider at creation; an iKhokha link can only be prepared for a transaction explicitly created for iKhokha (legacy transactions with no provider provenance fail closed).
- A provider-specific immutable intent snapshots transaction ID, iKhokha connection, external reference, amount in minor units and currency. This initial implementation permits ZAR only; other currency exponents must be explicitly implemented and tested before support.
- A row-locked, single-use claim changes the intent from `prepared` to `creating`. A repeated request cannot create a second link.
- The signed request uses the documented iKhokha endpoint and request-body signature. The response must have responseCode 00, the same externalTransactionID, a paylinkID and a securepay.ikhokha.red URL.
- The finalization RPC persists the paylink ID, URL, amount/currency provenance and intent ID to the payment ledger. It does not mark the transaction paid or release fulfilment.
- Unknown provider outcomes, malformed responses and persistence conflicts are sent to manual review. They are never retried automatically.

## Required server-side configuration
`IKHOKHA_APP_ID`, `IKHOKHA_APP_SECRET`, `IKHOKHA_ENTITY_ID`, `IKHOKHA_REQUESTER_URL`, `IKHOKHA_SUCCESS_URL`, `IKHOKHA_FAILURE_URL`, and `IKHOKHA_LIVE_CHECKOUT_ENABLED=true`.

The database activation control must independently have `live_enabled=true` and `gate_decision=GO`. No client may set either gate. Provider connection must be active/ready and explicitly advertise checkout capability.

## Current limitation
The current project has no configured iKhokha provider connection or verified credentials. This change is therefore a dormant implementation until partner setup and independent approval are complete. Do not deploy the migration or function to production until CI, SQL review, and a non-money-moving integration test pass. Even after deployment, live checkout remains blocked until all server-side gates and configuration are intentionally approved.

## Evidence
Official iKhokha API contract: https://developer.ikhokha.com/overview
