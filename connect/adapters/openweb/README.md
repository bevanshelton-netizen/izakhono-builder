# OpenWeb adapter boundary

The public OpenWeb Reseller API contract has been verified from the current OpenAPI document.

Base URL: `https://reseller.openweb.co.za`

Relevant operations currently exposed by OpenWeb include:

- `GET /api/v1/products`
- `POST /api/v1/fibre/coverage`
- `POST /api/v1/orders`
- `POST /api/v1/endusers/assign-product`
- `GET /api/v1/services`
- `GET /api/v1/services/{service_id}`
- `POST /api/v1/services/{service_id}/cancel`
- `GET /api/v1/wallet`
- `GET /api/v1/invoices`
- `GET /api/v1/endusers`

OpenWeb uses reseller-scoped bearer tokens and documents a rate limit of 100 requests/minute/token.

## Activation gate

The adapter is intentionally **planned/not-configured** until IZAKHONO has an approved OpenWeb reseller account and a server-side API token. No token belongs in browser code, GitHub, Supabase client configuration, or customer-visible responses.

The CONNECT control plane should map its internal product codes to OpenWeb product IDs only after the approved reseller catalogue is available. Pricing must be read from the provider catalogue where applicable; do not hard-code provider pricing as an authoritative source.

Fibre coverage is a special case: OpenWeb's current public API describes `/api/v1/fibre/coverage` as requiring a configured Axxess provider connection and returning an authorization token only for available live OpenServe coverage. A `503` represents verification unavailability, not a negative coverage result.

This file records the verified boundary; it does not claim that the OpenWeb reseller account or API credentials are active.
