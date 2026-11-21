# iKhokha authoritative payment-status reconciliation v2

## Evidence sources

A signed iKhokha webhook is only a notification that reconciliation should run. It is not payment proof and must never release fulfilment.

The reconciler loads the immutable local payment-link intent, including:
- external transaction reference;
- provider paylink ID;
- amount in minor currency units;
- currency captured before the provider request.

It then queries iKhokha's authoritative status endpoint using the exact external reference:

`GET /public-api/v1/api/getStatus/external?externalReference={externalTransactionID}`

The GET request signature is HMAC-SHA256 over the exact path and query string with an empty request body, using the merchant app secret and the documented iKhokha signature header.

## Fail-closed verification

The response is accepted only when all are true:
- lookup provenance is the exact external-reference query for the immutable intent;
- returned paylink ID equals the intent's paylink ID;
- returned status is `PAID`;
- returned amount is an integer in minor units and equals the intent amount;
- returned `createdAt` is a valid timezone-qualified ISO timestamp.

Do not require currency or external transaction reference to appear in the provider status response. Those fields may be omitted. Currency and reference are taken from the immutable local intent and the exact lookup request, never inferred from the provider response.

Any missing field, mismatch, invalid timestamp, non-PAID status, timeout, signature failure, or ambiguous provider response results in manual review. Do not mark the transaction paid or release fulfilment.

## Atomic release requirements

The production reconciler must execute a single database transaction that:
1. Locks the payment transaction and immutable intent rows.
2. Re-checks the expected provider, transaction reference, paylink ID, amount, currency and current status.
3. Persists the authoritative status evidence and a stable provider lookup/evidence digest.
4. Performs an idempotent transition to paid only if every check passes.
5. Releases the fulfilment outbox/event in the same transaction, exactly once.
6. Leaves duplicate callbacks/retries harmless and moves conflicting evidence to manual review.

The webhook handler must remain trigger-only. The reconciler must not accept caller-supplied observed status as evidence; it must perform the signed provider GET itself.

## Current implementation boundary

The pure verifier and contract tests in this directory are a validation layer only. They do not call iKhokha, mutate payment state, or release fulfilment. Production activation remains disabled until the signed GET adapter, atomic database transition, retry/concurrency tests, merchant credentials, and end-to-end evidence are deployed and verified.
