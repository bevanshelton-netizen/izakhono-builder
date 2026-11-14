# iKhokha authoritative status reconciliation contract

## Verified provider contract

The official iK Pay API documentation specifies:

- Status by external reference: `GET /public-api/v1/api/getStatus/external?externalReference={externalTransactionID}`
- Status by payment-link ID: `GET /public-api/v1/api/getStatus/external?paymentLinkId={paylinkID}`
- Status response fields: `paylinkID`, `status`, `createdAt`, `amount`, optional `description`.
- Amount is in the smallest currency unit.
- The status response does not document `externalTransactionID`, `currency`, or `responseCode`.
- Requests require `IK-APPID` and `IK-SIGN`; signature is HMAC-SHA256 over `path + requestBody` using the application secret. For GET status requests the request body is empty, so sign the exact path including its query string.

## Reconciliation requirements

1. Load the payment transaction from the database by immutable transaction ID. Never accept amount, currency, external reference or paylink ID from the caller as authoritative.
2. Require provider = `ikhokha`, a stored external reference, a stored paylink ID, positive amount and a three-letter currency captured from the trusted payment intent before payment-link creation.
3. Query the status endpoint by the stored external reference. Sign the exact path and query string using the documented request-signing algorithm.
4. Compare returned `paylinkID`, `amount`, `status=PAID`, and valid `createdAt` against the stored payment intent. Currency is proven by the immutable original intent used to create the link, not by the status response.
5. If the link ID, amount, currency provenance, external reference or provider status cannot be verified, set/retain manual review. Never infer a missing value.
6. A successful provider lookup is evidence only. Payment state change and fulfilment release must be performed by one database transaction with row locking, idempotency, provider match, amount/currency match, and an exactly-once activation guard.
7. Do not release fulfilment from the webhook. It is only a trigger to schedule reconciliation.
8. Never log application secrets, request signatures, full customer payloads or sensitive payment details.

## Current implementation boundary

The existing transaction table has a currency field and a provider payment ID field, but the inspected recent transaction records do not contain iKhokha link IDs in metadata or provider payment ID. The current payment-link creation path has not been verified as persisting a returned `paylinkID`. Therefore the reconciler must not be enabled until the creation path atomically persists the original currency, external reference, amount and returned paylink ID.

This contract intentionally does not authorize payment mutation or fulfilment by itself.
